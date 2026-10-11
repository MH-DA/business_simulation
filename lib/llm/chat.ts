import type { Card, CollectedPlace } from "../../types/index.ts";
import { searchKnowledge } from "../knowledge/search.ts";
import type { KnowledgeBase } from "../knowledge/index.ts";
import { buildComparison } from "../metrics/comparison.ts";
import { classifyQuestion, topicSignals, type Intent } from "./intent.ts";
import { MarkerFilter, parseOutput } from "./output.ts";
import { buildPrompt, type Prompt } from "./prompt.ts";

export type Generate = (prompt: Prompt) => AsyncIterable<string>;

export type EvidenceCard = Extract<Card, { kind: "근거" }>;

export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "done"; evidence: EvidenceCard[]; confirm?: { question: string; buttons: string[] } };

export type ChatInput = {
  question: string;
  place: CollectedPlace;
  competitors: CollectedPlace[];
  knowledge: KnowledgeBase;
  generate: Generate;
};

const INTENT_SIGNAL: Record<Intent, string> = {
  new_customer: "new_customer",
  retention: "retention",
  strength_promotion: "strength_promotion",
  complaint_improve: "complaint_improve",
};

const FALLBACK_CONFIRM = {
  question: "이 방향이 우리 가게 상황에 맞는지 사장님이 직접 확인해 주세요.",
  buttons: ["네, 맞아요", "아니요", "잘 모르겠어요"],
};

// 질문 → 비교 사실 + 지식 검색 → LLM 답변. 근거 카드는 검색 결과에 실제로 있는 지식 ID만 보여준다.
export async function* runChat(input: ChatInput): AsyncGenerator<ChatEvent> {
  const { question, place, competitors, knowledge, generate } = input;
  const { intent, type } = classifyQuestion(question);
  const comparison = buildComparison(place.store, competitors[0]?.store, place.collectedAt);

  const chunks = searchKnowledge(knowledge.chunks, {
    tiers: [
      { signals: intent ? [INTENT_SIGNAL[intent]] : [], weight: 3 }, // 질문 의도
      { signals: topicSignals(question), weight: 2 }, // 질문에 나온 주제어
      { signals: comparison.signalTags, weight: 1 }, // 비교 사실
    ],
    industry: place.store.industry,
    max: 3,
  });

  const prompt = buildPrompt({
    question,
    type,
    storeName: place.store.name,
    industry: place.store.industry,
    comparison,
    chunks,
    guardrails: knowledge.guardrails,
  });

  const filter = new MarkerFilter();
  let full = "";
  for await (const piece of generate(prompt)) {
    full += piece;
    const visible = filter.push(piece);
    if (visible) yield { type: "delta", text: visible };
  }

  const parsed = parseOutput(full);
  const found = new Map(chunks.map((c) => [c.id, c]));
  const evidence: EvidenceCard[] = parsed.usedIds
    .filter((id) => found.has(id))
    .map((id) => {
      const c = found.get(id)!;
      return { id: `ev-${id}`, kind: "근거", knowledgeId: id, title: c.principle, summary: c.core.slice(0, 3).join(" · "), strength: c.strength };
    });

  const confirm = parsed.confirm ?? (type === "판단 보조" ? FALLBACK_CONFIRM : undefined);
  yield { type: "done", evidence, confirm };
}
