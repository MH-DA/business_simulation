import type { Industry, KnowledgeChunk } from "../../types/index.ts";

// 지식 조각 검색: 신호 이름이 조각의 signalTypes에 들어 있으면 그 묶음(tier)의 가중치를 더한다. (PROJECT.md 검색 방식)
// 신호 이름은 조각을 찾는 열쇠일 뿐이고, 점수나 판정이 아니다. 묶음 순서: 질문 의도 > 질문 속 주제어 > 비교 사실.
export type SignalTier = { signals: string[]; weight: number };
export type KnowledgeQuery = { tiers: SignalTier[]; industry: Industry; max?: number };

export function searchKnowledge(chunks: KnowledgeChunk[], q: KnowledgeQuery): KnowledgeChunk[] {
  const max = q.max ?? 3;
  return chunks
    .map((c, i) => {
      let score = 0;
      let best = 0;
      for (const t of q.tiers) {
        if (c.signalTypes.some((s) => t.signals.includes(s))) {
          score += t.weight;
          best = Math.max(best, t.weight);
        }
      }
      return { c, i, score, best, hasExample: Boolean(c.examples[q.industry]) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.best - a.best || Number(b.hasExample) - Number(a.hasExample) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.c);
}
