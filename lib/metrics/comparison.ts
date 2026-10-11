import type { Store } from "../../types/index.ts";

// 경쟁사 비교: 우리 가게와 추적 키워드 검색 1위 가게의 9개 항목을 나란히 놓는다.
// 점수·높음/낮음 판정·평균은 없다. 값과 날짜 차이만 만든다. (README "경쟁사 분석 흐름")
export type ComparisonRow = { item: string; mine: string; top: string };

export type Comparison = {
  topName?: string; // 비교 대상(검색 1위 가게)이 없으면 비어 있다
  rows: ComparisonRow[];
  // 지식 조각을 찾는 열쇠. 값 두 개를 견준 사실(없음, 더 많음, 더 오래됨)만으로 만들고 임계값은 쓰지 않는다.
  signalTags: string[];
};

const NONE = "비교 대상 없음";
const UNKNOWN = "수집 전";

const yesNo = (v: boolean | undefined) => (v === undefined ? UNKNOWN : v ? "있음" : "없음");
const num = (v: number | undefined) => (v === undefined ? UNKNOWN : String(v));

// 수집 시점(collectedAt) 기준 경과일. 오늘 날짜를 쓰면 같은 데이터가 볼 때마다 달라진다.
export function daysSince(date: string | undefined, collectedAt: string): number | undefined {
  if (!date) return undefined;
  const d = Date.parse(date);
  const c = Date.parse(collectedAt);
  if (Number.isNaN(d) || Number.isNaN(c)) return undefined;
  return Math.max(0, Math.floor((c - d) / 86_400_000));
}

const daysText = (n: number | undefined) => (n === undefined ? UNKNOWN : n === 0 ? "오늘" : `${n}일 전`);

export function buildComparison(mine: Store, top: Store | undefined, collectedAt: string): Comparison {
  const t = (f: (s: Store) => string) => (top ? f(top) : NONE);
  const myNews = daysSince(mine.lastNewsDate, collectedAt);
  const topNews = top ? daysSince(top.lastNewsDate, collectedAt) : undefined;

  const rows: ComparisonRow[] = [
    { item: "별점", mine: num(mine.rating), top: t((s) => num(s.rating)) },
    { item: "방문자 리뷰 수", mine: num(mine.visitorReviewCount), top: t((s) => num(s.visitorReviewCount)) },
    { item: "블로그 리뷰 수", mine: num(mine.blogReviewCount), top: t((s) => num(s.blogReviewCount)) },
    { item: "소개글", mine: yesNo(Boolean(mine.intro?.trim())), top: t((s) => yesNo(Boolean(s.intro?.trim()))) },
    { item: "편의시설", mine: yesNo(mine.amenities.length > 0), top: t((s) => yesNo(s.amenities.length > 0)) },
    { item: "쿠폰", mine: yesNo(mine.coupons.length > 0), top: t((s) => yesNo(s.coupons.length > 0)) },
    { item: "예약 탭", mine: yesNo(mine.hasBookingTab ?? mine.tabs.includes("예약")), top: t((s) => yesNo(s.hasBookingTab ?? s.tabs.includes("예약"))) },
    { item: "네이버페이", mine: yesNo(mine.hasNaverPay), top: t((s) => yesNo(s.hasNaverPay)) },
    { item: "최근 새소식", mine: daysText(myNews), top: top ? daysText(topNews) : NONE },
  ];

  const signalTags: string[] = [];
  if (mine.coupons.length === 0) signalTags.push("coupon_missing");
  if (!mine.intro?.trim()) signalTags.push("intro_weak");
  if (top && (mine.visitorReviewCount ?? 0) < (top.visitorReviewCount ?? 0)) signalTags.push("review_count_low");
  if (myNews !== undefined && topNews !== undefined && myNews > topNews) signalTags.push("news_inactive");

  return { topName: top?.name, rows, signalTags };
}
