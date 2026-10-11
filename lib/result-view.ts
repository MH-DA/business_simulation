import type { CollectedPlace, Store } from "@/types";
import { computeMetrics, describeFinding } from "@/lib/metrics";

// 결과 화면에 그대로 뿌리는 값. 점수·순위 없이 사실(수치)만 담는다.
// 비교·차이 계산은 lib/metrics 가 한다. 여기서는 화면에 맞게 고르고 문장으로 옮기기만 한다.
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

export function buildResultView(
  place: CollectedPlace,
  competitors: CollectedPlace[],
  isDemo: boolean,
): ResultViewModel {
  const { store, reviews } = place;
  const total = store.visitorReviewCount;
  const m = computeMetrics(place, competitors);
  const sorted = [...m.facts].sort((a, b) => b.ratioPct - a.ratioPct);

  const chips = (store.representativeKeywords.length
    ? store.representativeKeywords
    : sorted.slice(0, 4).map((k) => k.keyword)
  ).slice(0, 4);

  const strengths = sorted.slice(0, 3).map((k) => ({
    keyword: k.keyword,
    text: `'${k.keyword}' 키워드를 ${total ? `방문자 리뷰 ${total}건 중 ${k.count}건(${k.ratioPct}%)이` : `${k.ratioPct}%가`} 선택했어요.`,
  }));

  const concerns: InsightLine[] = m.findings
    .filter((f) => f.type === "낮음" && f.keyword)
    .sort((a, b) => (a.gapPp ?? 0) - (b.gapPp ?? 0))
    .slice(0, 3)
    .map((f) => ({ keyword: f.keyword!, text: describeFinding(f) ?? "" }));
  let concernsNote: string | undefined;
  if (m.insufficientSample) {
    concernsNote = "아직 방문자 리뷰가 적어서 판단하기 이르다고 봤어요. 리뷰가 더 쌓이면 비교해서 보여드려요.";
  } else if (competitors.length === 0) {
    concernsNote = "비교할 경쟁 매장 데이터가 아직 없어요. 경쟁 매장이 연결되면 우리 가게가 상대적으로 낮은 키워드를 보여드려요.";
  } else if (concerns.length === 0) {
    concernsNote = "경쟁 매장 평균보다 크게 낮은 키워드는 확인되지 않았어요.";
  }

  const top = sorted[0];
  const replied = reviews.filter((r) => r.hasOwnerReply).length;
  const parts: string[] = [];
  if (top) parts.push(`가장 많이 선택된 키워드는 '${top.keyword}'(${top.ratioPct}%)예요.`);
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
