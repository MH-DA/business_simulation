import type { Store } from "../../types/index.ts";
import { hasAmenities, hasBookingTab, hasCoupons, hasIntro } from "../checked.ts";

// 경쟁사 비교: 우리 가게와 사장님이 직접 고른 비교 가게(URL 입력)의 9개 항목을 나란히 놓는다.
// 점수·높음/낮음 판정·평균은 없다. 값과 날짜 차이만 만든다. (README "경쟁사 분석 흐름")
export type ComparisonRow = { item: string; mine: string; top: string };

export type Comparison = {
  topName?: string; // 비교 대상(사장님이 고른 가게)이 없으면 비어 있다
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

// 두 가게의 차이: 같은 항목에서 각 가게 쪽이 더 많거나, 있거나, 더 최근인 것만 모은다.
// "강점/약점" 같은 판정이나 중요도는 붙이지 않는다. 한쪽이라도 수집 전이면 비교하지 않는다.
export type Difference = { item: string; mine: string; other: string };
export type Differences = { mine: Difference[]; other: Difference[] };

export function buildDifferences(mine: Store, other: Store): Differences {
  const out: Differences = { mine: [], other: [] };
  const push = (a: number, b: number, d: Difference) => {
    if (a > b) out.mine.push(d);
    else if (b > a) out.other.push(d);
  };

  const numbers: [string, (s: Store) => number | undefined, (n: number) => string][] = [
    ["별점", (s) => s.rating, (n) => `★ ${n.toFixed(1)}`],
    ["방문자 리뷰 수", (s) => s.visitorReviewCount, (n) => `${n.toLocaleString("ko-KR")}개`],
    ["블로그 리뷰 수", (s) => s.blogReviewCount, (n) => `${n.toLocaleString("ko-KR")}개`],
  ];
  for (const [item, get, fmt] of numbers) {
    const a = get(mine);
    const b = get(other);
    if (a !== undefined && b !== undefined) push(a, b, { item, mine: fmt(a), other: fmt(b) });
  }

  const flags: [string, (s: Store) => boolean | undefined][] = [
    ["소개글", hasIntro],
    ["편의시설", hasAmenities],
    ["쿠폰", hasCoupons],
    ["예약 탭", hasBookingTab],
    ["네이버페이", (s) => s.hasNaverPay],
  ];
  for (const [item, get] of flags) {
    const a = get(mine);
    const b = get(other);
    if (a !== undefined && b !== undefined && a !== b) {
      push(Number(a), Number(b), { item, mine: a ? "있음" : "없음", other: b ? "있음" : "없음" });
    }
  }

  const ta = mine.lastNewsDate ? Date.parse(mine.lastNewsDate) : NaN;
  const tb = other.lastNewsDate ? Date.parse(other.lastNewsDate) : NaN;
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
    push(ta, tb, { item: "최근 새소식", mine: mine.lastNewsDate!.slice(0, 10), other: other.lastNewsDate!.slice(0, 10) });
  }
  return out;
}

export function buildComparison(mine: Store, top: Store | undefined, collectedAt: string): Comparison {
  const t = (f: (s: Store) => string) => (top ? f(top) : NONE);
  const myNews = daysSince(mine.lastNewsDate, collectedAt);
  const topNews = top ? daysSince(top.lastNewsDate, collectedAt) : undefined;

  const rows: ComparisonRow[] = [
    { item: "별점", mine: num(mine.rating), top: t((s) => num(s.rating)) },
    { item: "방문자 리뷰 수", mine: num(mine.visitorReviewCount), top: t((s) => num(s.visitorReviewCount)) },
    { item: "블로그 리뷰 수", mine: num(mine.blogReviewCount), top: t((s) => num(s.blogReviewCount)) },
    { item: "소개글", mine: yesNo(hasIntro(mine)), top: t((s) => yesNo(hasIntro(s))) },
    { item: "편의시설", mine: yesNo(hasAmenities(mine)), top: t((s) => yesNo(hasAmenities(s))) },
    { item: "쿠폰", mine: yesNo(hasCoupons(mine)), top: t((s) => yesNo(hasCoupons(s))) },
    { item: "예약 탭", mine: yesNo(hasBookingTab(mine)), top: t((s) => yesNo(hasBookingTab(s))) },
    { item: "네이버페이", mine: yesNo(mine.hasNaverPay), top: t((s) => yesNo(s.hasNaverPay)) },
    { item: "최근 새소식", mine: daysText(myNews), top: top ? daysText(topNews) : NONE },
  ];

  const signalTags: string[] = [];
  if (hasCoupons(mine) === false) signalTags.push("coupon_missing");
  if (hasIntro(mine) === false) signalTags.push("intro_weak");
  if (top && (mine.visitorReviewCount ?? 0) < (top.visitorReviewCount ?? 0)) signalTags.push("review_count_low");
  if (myNews !== undefined && topNews !== undefined && myNews > topNews) signalTags.push("news_inactive");

  return { topName: top?.name, rows, signalTags };
}
