import type { CollectedPlace, Guardrail } from "@/types";
import type { Generate } from "@/lib/llm";

// 분석 결과 화면의 글 부분(Figma 04 리뷰·제안 카드)을 LLM으로 만든다.
// - 숫자는 만들지 않는다. 화면의 숫자는 lib/result-view.ts 가 센 값만 쓴다.
// - 가게마다 한 번 만들어 메모리에 둔다(서버를 다시 켜면 다시 만든다). DB가 붙으면 snapshots 옆에 저장한다.
// - LLM이 없거나 형식이 틀리면 리뷰 키워드만으로 만든 기본 문장을 쓴다.

export type Insights = {
  summary: string; // 리뷰 한 줄 요약 (2줄 이내)
  hashtags: string[]; // 최대 4개, # 없이
  likes: string; // 고객이 좋아하는 점 (2문장 이내)
  checks: string; // 함께 확인하면 좋은 점 (2문장 이내)
  proposal?: { headline: string; body: string }; // PLACEMENT의 제안
  source: "llm" | "fallback";
};

const cache = new Map<string, Promise<Insights>>();

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export function fallbackInsights(place: CollectedPlace): Insights {
  const top = [...place.keywordStats].sort((a, b) => b.count - a.count).map((k) => k.keyword);
  return {
    summary: top.length
      ? `손님들은 '${top[0]}'${top[1] ? `, '${top[1]}'` : ""} 키워드를 가장 많이 골랐어요.`
      : "아직 리뷰 키워드가 충분하지 않아요.",
    hashtags: (place.store.representativeKeywords.length ? place.store.representativeKeywords : top).slice(0, 4),
    likes: top.length ? `'${top.slice(0, 3).join("', '")}' 같은 점을 좋게 봤어요.` : "리뷰가 더 쌓이면 손님이 좋아하는 점을 정리해 드릴게요.",
    checks: "리뷰 원문 요약은 AI 연결 후 보여드려요.",
    source: "fallback",
  };
}

function buildPrompt(place: CollectedPlace, guardrails: Guardrail[]) {
  const s = place.store;
  const top = [...place.keywordStats].sort((a, b) => b.count - a.count).slice(0, 8);
  const reviews = place.reviews
    .slice(0, 40)
    .map((r, i) => `${i + 1}. ${r.body.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");

  const system = [
    "너는 동네 가게 사장님의 네이버 플레이스를 함께 살펴보는 도우미다. 해요체로 짧고 쉽게 쓴다.",
    "규칙:",
    "1. 아래 '가게 정보'와 '리뷰'에 있는 내용만 근거로 쓴다. 없는 사실, 숫자, 비율, 순위는 만들지 않는다.",
    "2. 점수나 등급을 매기지 않고, '가장 급하다' 같은 단정을 하지 않는다.",
    "3. 아쉬운 점은 리뷰에 실제로 나온 내용만, 부드럽게 '확인해 보세요' 형태로 쓴다. 없으면 '특별히 반복되는 불편은 보이지 않아요'라고 쓴다.",
    "4. 제안 문구는 과장 광고(최고, 1등, 보장)를 쓰지 않는다.",
    ...guardrails.map((g) => `- ${g.id} ${g.rule}`),
    "",
    "출력은 JSON 하나만, 다른 글 없이:",
    '{"summary":"리뷰 요약 1~2문장(60자 이내)","hashtags":["키워드 2~4개, # 없이, 8자 이내"],"likes":"고객이 좋아하는 점 1~2문장","checks":"함께 확인하면 좋은 점 1~2문장","proposal":{"headline":"가게를 알릴 한 줄 문구(25자 이내)","body":"그 문구를 어떻게 써볼지 2~3문장"}}',
  ].join("\n");

  const user = [
    "[가게 정보]",
    `이름: ${s.name} / 업종: ${s.industry} (${s.category})`,
    s.intro ? `소개글: ${s.intro.slice(0, 300)}` : "소개글: 없음",
    s.amenities.length ? `편의시설: ${s.amenities.join(", ")}` : "",
    s.openHours ? `영업시간: ${s.openHours}` : "",
    top.length ? `손님이 고른 키워드: ${top.map((k) => k.keyword).join(", ")}` : "",
    "",
    `[리뷰 ${place.reviews.length}개 중 일부]`,
    reviews || "(리뷰 원문 없음)",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

function parse(text: string): Omit<Insights, "source"> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const p = (j.proposal ?? {}) as Record<string, unknown>;
    const out = {
      summary: clip(j.summary, 120),
      hashtags: Array.isArray(j.hashtags) ? j.hashtags.map((h) => clip(h, 12).replace(/^#/, "")).filter(Boolean).slice(0, 4) : [],
      likes: clip(j.likes, 200),
      checks: clip(j.checks, 200),
      proposal: clip(p.headline, 40) ? { headline: clip(p.headline, 40), body: clip(p.body, 260) } : undefined,
    };
    return out.summary && out.likes ? out : null;
  } catch {
    return null;
  }
}

export function getInsights(place: CollectedPlace, generate: Generate | null, guardrails: Guardrail[]): Promise<Insights> {
  const key = place.store.placeId;
  const hit = cache.get(key);
  if (hit) return hit;

  const job = (async (): Promise<Insights> => {
    if (!generate || place.reviews.length + place.keywordStats.length === 0) return fallbackInsights(place);
    let text = "";
    for await (const piece of generate(buildPrompt(place, guardrails))) text += piece;
    const parsed = parse(text);
    return parsed ? { ...parsed, source: "llm" } : fallbackInsights(place);
  })().catch((err) => {
    console.error("insights failed:", err);
    cache.delete(key); // 실패는 저장하지 않는다 (다음 요청에서 다시 시도)
    return fallbackInsights(place);
  });

  cache.set(key, job);
  return job;
}
