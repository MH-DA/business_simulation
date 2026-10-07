import type { CollectedPlace, KeywordStat } from "@/types";

// 2단계(화면)용 최소 계산. 4단계 지표 계산 모듈에서 Finding·신호 유형으로 확장한다.
// 점수·가중치·순위는 만들지 않고, 비율과 경쟁 평균 대비 차이(사실)만 계산한다.

export const MIN_REVIEWS = 30; // 이보다 적으면 수치 대신 "아직 판단하기 이르다"
const GAP_THRESHOLD_PP = 5; // 경쟁 평균보다 이만큼(%p) 낮을 때만 표시

export type KeywordGap = {
  keyword: string;
  mine: number; // %
  competitorAvg: number; // %
  gapPp: number; // mine - competitorAvg
};

export type PlaceSummary = {
  enoughReviews: boolean;
  topKeywords: KeywordStat[]; // 선택 비율이 높은 순 3개
  lowerThanCompetitors: KeywordGap[]; // 경쟁 평균보다 낮은 키워드, 차이가 큰 순 3개
  competitorCount: number;
};

const pct = (r: number) => Math.round(r * 100);

export function summarize(place: CollectedPlace, competitors: CollectedPlace[]): PlaceSummary {
  const reviews = place.store.visitorReviewCount ?? 0;
  const sorted = [...place.keywordStats].sort((a, b) => b.ratio - a.ratio);

  const lower: KeywordGap[] = [];
  if (competitors.length > 0) {
    for (const k of place.keywordStats) {
      const others = competitors
        .map((c) => c.keywordStats.find((x) => x.keyword === k.keyword)?.ratio)
        .filter((r): r is number => typeof r === "number");
      if (others.length === 0) continue;
      const avg = others.reduce((s, r) => s + r, 0) / others.length;
      const gap = pct(k.ratio) - pct(avg);
      if (gap <= -GAP_THRESHOLD_PP) {
        lower.push({ keyword: k.keyword, mine: pct(k.ratio), competitorAvg: pct(avg), gapPp: gap });
      }
    }
  }
  lower.sort((a, b) => a.gapPp - b.gapPp);

  return {
    enoughReviews: reviews >= MIN_REVIEWS,
    topKeywords: sorted.slice(0, 3),
    lowerThanCompetitors: lower.slice(0, 3),
    competitorCount: competitors.length,
  };
}

export const toPercent = pct;
