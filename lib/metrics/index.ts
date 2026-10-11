import type { CollectedPlace, Finding, Store } from "@/types";
import { categoryOf, classifyKeyword, type KeywordGroup } from "./categories.ts";

// 점수·가중치·순위 없음. 사실(수치)과 신호 유형만 내보낸다. (PROJECT.md 10장, LLM 사용 안 함)
// 아래 기준값은 가정이라 팀이 바꿀 수 있게 한 곳에 둔다.
export const THRESHOLDS = {
  minReviews: 30, // 방문자 리뷰가 이보다 적으면 수치 판단을 미룬다
  keywordGapPp: 10, // 경쟁 평균과 이 %p 이상 차이 나면 높음/낮음으로 표시
  highRating: 4.9,
  fewReviewsShare: 0.5, // 경쟁 평균 리뷰 수의 이 비율보다 적으면 "적음"
} as const;

export type KeywordFact = {
  keyword: string;
  group: KeywordGroup;
  count: number;
  ratioPct: number; // 선택 인원 ÷ 방문자 리뷰 수, % (반올림)
  competitorAvgPct?: number; // 경쟁 매장 평균 비율, % (반올림)
  gapPp?: number; // 반올림한 두 값의 차이 (내 값 − 경쟁 평균)
};

export type InfoCheck = { item: string; present: boolean };

export type MetricsResult = {
  facts: KeywordFact[]; // 비율이 높은 순 정렬은 하지 않고 입력 순서를 유지한다
  findings: Finding[];
  infoChecks: InfoCheck[];
  insufficientSample: boolean; // true면 수치 대신 "아직 판단하기 이르다"를 보여준다
  competitorCount: number;
};

const pct = (r: number) => Math.round(r * 100);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function ratioOf(count: number, stored: number, store: Store): number {
  return store.visitorReviewCount ? count / store.visitorReviewCount : stored;
}

export function infoChecksOf(store: Store): InfoCheck[] {
  return [
    { item: "업종 등록 정보", present: Boolean(store.category) },
    { item: "편의시설 설정", present: store.amenities.length > 0 },
    { item: "소개글", present: Boolean(store.intro?.trim()) },
    { item: "대표 키워드", present: store.representativeKeywords.length > 0 },
    { item: "예약 탭", present: store.hasBookingTab === true },
  ];
}

export function computeMetrics(place: CollectedPlace, competitors: CollectedPlace[]): MetricsResult {
  const { store, keywordStats } = place;
  const insufficientSample = (store.visitorReviewCount ?? 0) < THRESHOLDS.minReviews;
  const infoChecks = infoChecksOf(store);
  const findings: Finding[] = [];

  const facts: KeywordFact[] = keywordStats.map((k) => {
    const mine = ratioOf(k.count, k.ratio, store);
    const fact: KeywordFact = { keyword: k.keyword, group: classifyKeyword(k.keyword), count: k.count, ratioPct: pct(mine) };
    if (competitors.length > 0) {
      const compAvg = avg(
        competitors.map((c) => {
          const s = c.keywordStats.find((x) => x.keyword === k.keyword);
          return s ? ratioOf(s.count, s.ratio, c.store) : 0;
        }),
      );
      fact.competitorAvgPct = pct(compAvg);
      fact.gapPp = fact.ratioPct - fact.competitorAvgPct;
    }
    return fact;
  });

  if (!insufficientSample) {
    let n = 0;
    for (const f of facts) {
      if (f.gapPp === undefined || Math.abs(f.gapPp) < THRESHOLDS.keywordGapPp) continue;
      const low = f.gapPp < 0;
      const category = categoryOf(f.group);
      const isPrice = f.group === "가격";
      findings.push({
        id: `kw-${++n}`,
        type: low ? "낮음" : "높음",
        keyword: f.keyword,
        mine: f.ratioPct,
        competitorAvg: f.competitorAvgPct,
        gapPp: f.gapPp,
        category,
        // 가격 키워드가 낮으면 전용 신호, 그 밖에는 챗봇 의도 신호(불편 개선/강점 홍보)로 연결한다
        signalType: low ? (isPrice ? "price_keyword_low" : "complaint_improve") : "strength_promotion",
        // 가격은 운영 방식(가격 정책) 차이일 수 있어 사장님께 확인한다
        needsOwnerCheck: isPrice && low,
      });
    }

    const counts = competitors.map((c) => c.store.visitorReviewCount).filter((v): v is number => v != null);
    if (counts.length > 0 && store.visitorReviewCount != null) {
      const compAvgReviews = avg(counts);
      const few = store.visitorReviewCount < compAvgReviews * THRESHOLDS.fewReviewsShare;
      if (few) {
        findings.push({
          id: "review-count",
          type: "낮음",
          mine: store.visitorReviewCount,
          competitorAvg: Math.round(compAvgReviews),
          category: "마케팅",
          signalType: "review_count_low",
          needsOwnerCheck: true,
        });
        if (store.rating != null && store.rating >= THRESHOLDS.highRating) {
          findings.push({
            id: "rating-high",
            type: "정보",
            mine: store.rating,
            category: "마케팅",
            signalType: "rating_high_reviews_low",
            needsOwnerCheck: false,
          });
        }
      }
    }
  }

  if (!infoChecks.find((c) => c.item === "소개글")!.present) {
    findings.push({
      id: "intro-missing",
      type: "정보",
      category: "마케팅",
      signalType: "intro_weak",
      needsOwnerCheck: false,
    });
  }

  return { facts, findings, infoChecks, insufficientSample, competitorCount: competitors.length };
}

// Finding → 화면 문장. 숫자는 Finding에 담긴 값만 쓴다.
export function describeFinding(f: Finding): string | null {
  if (f.keyword && f.mine != null && f.competitorAvg != null && f.gapPp != null) {
    const dir = f.gapPp < 0 ? "낮아요" : "높아요";
    return `'${f.keyword}' 선택 비율이 ${f.mine}%로, 경쟁 매장 평균(${f.competitorAvg}%)보다 ${Math.abs(f.gapPp)}%p ${dir}.`;
  }
  if (f.signalType === "review_count_low" && f.mine != null && f.competitorAvg != null) {
    return `방문자 리뷰가 ${f.mine}건으로, 경쟁 매장 평균(${f.competitorAvg}건)보다 적어요.`;
  }
  return null;
}
