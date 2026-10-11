import type { Guardrail, Industry, KnowledgeChunk } from "../../types/index.ts";
import type { Comparison } from "../metrics/comparison.ts";
import type { QuestionType } from "./intent.ts";

export type Prompt = { system: string; user: string };

export type PromptInput = {
  question: string;
  type: QuestionType;
  storeName: string;
  industry: Industry;
  comparison: Comparison;
  chunks: KnowledgeChunk[];
  guardrails: Guardrail[];
};

const TYPE_GUIDE: Record<QuestionType, string> = {
  "진단 설명": "관련 비교 사실 → 관련 원리 → 해석 순서로 설명한다. 무엇을 먼저 해야 한다고 단정하지 않는다.",
  "실행안 생성": "가게 사실과 원리를 바탕으로 바로 쓸 수 있는 문구나 실행 방법을 2~3개 제안한다.",
  "판단 보조": "결론(해도 된다/안 된다)을 내리지 않는다. 근거를 정리하고, 사장님이 직접 확인할 질문 하나로 끝낸다.",
};

export const MARKER_RULES = [
  "답변 본문이 끝나면 새 줄에 아래 형식의 표시를 붙인다. 표시는 본문과 섞지 않는다.",
  "[[근거: K-xxx-00, K-xxx-00]]  ← 실제로 사용한 지식 ID만. 사용한 지식이 없으면 이 줄을 쓰지 않는다.",
  "[[확인: 사장님께 물을 질문 | 버튼1 | 버튼2 | 버튼3]]  ← 판단 보조형이거나 확인이 꼭 필요할 때만.",
].join("\n");

export function buildSystemPrompt(type: QuestionType, guardrails: Guardrail[]): string {
  return [
    "너는 동네 소상공인 사장님의 네이버 플레이스 마케팅을 돕는 상담 도우미다. 해요체로 짧고 쉽게 답한다.",
    "",
    "[공통 규칙]",
    "1. 점수, 순위, 종합 평가를 매기지 않는다. 무엇이 가장 급하다고 단정하지 않고, 근거를 보여주고 사장님이 판단하게 한다.",
    "2. '비교 사실' 표에 없는 숫자나 사실은 만들지 않는다. 표에 '수집 전'이라고 된 값은 모른다고 말한다.",
    "3. 설명의 근거는 '지식 조각'에 있는 것만 쓴다. 지식 조각이 없으면 일반적인 설명에 그치고 단정하지 않는다.",
    "4. 지식 조각의 강도가 '혼재'이면 단정하지 않고 조건을 함께 말한다. '중간'이면 '가능성이 높아요'처럼 표현 수위를 낮춘다.",
    "5. 지식 조각의 '주의' 내용을 지킨다.",
    "6. 아래 가드레일에 어긋나는 제안은 하지 않는다.",
    ...guardrails.map((g) => `   - ${g.id} ${g.rule}: ${g.detail}`),
    "",
    `[이번 질문 유형: ${type}]`,
    TYPE_GUIDE[type],
    "",
    "[출력 형식]",
    MARKER_RULES,
  ].join("\n");
}

const clip = (s: string | undefined, n: number) => (!s ? "" : s.length > n ? `${s.slice(0, n)}…` : s);

function chunkBlock(c: KnowledgeChunk, industry: Industry): string {
  const lines = [
    `[${c.id}] ${c.principle} (${c.category}, 강도: ${c.strength})`,
    `- 핵심: ${c.core.join(", ")}`,
    `- 적용: ${c.apply.join(", ")}`,
  ];
  const example = c.examples[industry];
  if (example) lines.push(`- ${industry} 예시: ${example}`);
  if (c.description) lines.push(`- 설명: ${clip(c.description, 420)}`);
  if (c.caution) lines.push(`- 주의: ${clip(c.caution, 200)}`);
  return lines.join("\n");
}

export function buildUserPrompt(i: PromptInput): string {
  const table = i.comparison.topName
    ? `| 항목 | 우리 가게(${i.storeName}) | 검색 1위 가게(${i.comparison.topName}) |\n|---|---|---|\n` +
      i.comparison.rows.map((r) => `| ${r.item} | ${r.mine} | ${r.top} |`).join("\n")
    : `비교할 1위 가게 정보가 아직 없다. 우리 가게(${i.storeName}) 값:\n` +
      i.comparison.rows.map((r) => `- ${r.item}: ${r.mine}`).join("\n");

  const knowledge = i.chunks.length
    ? i.chunks.map((c) => chunkBlock(c, i.industry)).join("\n\n")
    : "(이 질문에 맞는 지식 조각이 없다)";

  return [`업종: ${i.industry}`, "", "[비교 사실]", table, "", "[지식 조각]", knowledge, "", "[사장님 질문]", i.question].join("\n");
}

export function buildPrompt(i: PromptInput): Prompt {
  return { system: buildSystemPrompt(i.type, i.guardrails), user: buildUserPrompt(i) };
}
