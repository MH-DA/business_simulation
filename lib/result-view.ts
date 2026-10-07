import type { CollectedPlace, Store } from "@/types";

// 결과 화면에 그대로 뿌리는 값. 점수·순위 없이 사실(수치)만 담는다.
// 4단계에서 lib/metrics 가 생기면 이 계산을 그쪽으로 옮긴다. 지금은 비율 비교만 하는 단순 계산이다.
export type InsightLine = { keyword: string; text: string };

export type ResultViewModel = {
  store: Store;
  chips: string[];
  strengths: InsightLine[];
  concerns: InsightLine[];
  concernsNote?: string; // 비교할 데이터가 없을 때 안내
  reviewText: string;
  reviewNote: string;
  isDemo: boolean;
};

const pct = (r: number) => Math.round(r * 100);

export function buildResultView(
  place: CollectedPlace,
  competitors: CollectedPlace[],
  isDemo: boolean,
): ResultViewModel {
  const { store, keywordStats, reviews } = place;
  const total = store.visitorReviewCount;
  const sorted = [...keywordStats].sort((a, b) => b.ratio - a.ratio);

  const chips = (store.representativeKeywords.length
    ? store.representativeKeywords
    : sorted.slice(0, 4).map((k) => k.keyword)
  ).slice(0, 4);

  const strengths = sorted.slice(0, 3).map((k) => ({
    keyword: k.keyword,
    text: `'${k.keyword}' 키워드를 ${total ? `방문자 리뷰 ${total}건 중 ${k.count}건(${pct(k.ratio)}%)이` : `${pct(k.ratio)}%가`} 선택했어요.`,
  }));

  let concerns: InsightLine[] = [];
  let concernsNote: string | undefined;
  if (competitors.length === 0) {
    concernsNote = "비교할 경쟁 매장 데이터가 아직 없어요. 경쟁 매장이 연결되면 우리 가게가 상대적으로 낮은 키워드를 보여드려요.";
  } else {
    concerns = keywordStats
      .map((k) => {
        const avg =
          competitors.reduce(
            (sum, c) => sum + (c.keywordStats.find((x) => x.keyword === k.keyword)?.ratio ?? 0),
            0,
          ) / competitors.length;
        return { keyword: k.keyword, mine: pct(k.ratio), avg: pct(avg) };
      })
      .filter((x) => x.avg > x.mine)
      .sort((a, b) => b.avg - b.mine - (a.avg - a.mine))
      .slice(0, 3)
      .map((x) => ({
        keyword: x.keyword,
        text: `'${x.keyword}' 선택 비율이 ${x.mine}%로, 경쟁 매장 평균(${x.avg}%)보다 ${x.avg - x.mine}%p 낮아요.`,
      }));
    if (concerns.length === 0) concernsNote = "경쟁 매장 평균보다 낮은 키워드는 확인되지 않았어요.";
  }

  const top = sorted[0];
  const replied = reviews.filter((r) => r.hasOwnerReply).length;
  const parts: string[] = [];
  if (top) parts.push(`가장 많이 선택된 키워드는 '${top.keyword}'(${pct(top.ratio)}%)예요.`);
  if (reviews.length) parts.push(`수집된 리뷰 ${reviews.length}건 중 ${replied}건에 사장님 답글이 있어요.`);

  return {
    store,
    chips,
    strengths,
    concerns,
    concernsNote,
    reviewText: parts.join(" ") || "아직 확인된 리뷰가 없어요.",
    reviewNote:
      "샘플 분석 · 실제 리뷰와 수집 범위가 연결되면 근거 리뷰 및 분석 기준일을 표시합니다.",
    isDemo,
  };
}
