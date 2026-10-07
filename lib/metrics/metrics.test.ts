import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectedPlace, Store } from "../../types/index.ts";
import { classifyKeyword, categoryOf } from "./categories.ts";
import { computeMetrics, describeFinding, THRESHOLDS } from "./index.ts";

function store(over: Partial<Store> = {}): Store {
  return {
    placeId: "a", name: "A", category: "헬스장", tabs: [], amenities: ["주차"], representativeKeywords: [],
    coupons: [], industry: "헬스장", visitorReviewCount: 200, rating: 4.5, intro: "소개", hasBookingTab: true, ...over,
  };
}
function place(s: Store, kws: [string, number][]): CollectedPlace {
  return {
    store: s,
    keywordStats: kws.map(([keyword, count]) => ({ keyword, count, ratio: count / (s.visitorReviewCount ?? 1) })),
    reviews: [], collectedAt: "2026-01-01T00:00:00Z", source: "mock",
  };
}

test("비율 = 선택 인원 ÷ 방문자 리뷰 수", () => {
  const r = computeMetrics(place(store(), [["시설이 깔끔해요", 140]]), []);
  assert.equal(r.facts[0].ratioPct, 70);
  assert.equal(r.facts[0].gapPp, undefined); // 경쟁 매장 없으면 차이 없음
  assert.equal(r.findings.filter((f) => f.keyword).length, 0);
});

test("경쟁 평균과의 차이(%p)와 신호 유형", () => {
  const mine = place(store(), [["가격이 합리적이에요", 40], ["시설이 깔끔해요", 140]]);
  const c1 = place(store({ placeId: "b", visitorReviewCount: 400 }), [["가격이 합리적이에요", 200], ["시설이 깔끔해요", 240]]);
  const r = computeMetrics(mine, [c1]);
  const price = r.findings.find((f) => f.keyword === "가격이 합리적이에요")!;
  assert.deepEqual([price.mine, price.competitorAvg, price.gapPp], [20, 50, -30]);
  assert.equal(price.type, "낮음");
  assert.equal(price.signalType, "price_keyword_low");
  assert.equal(price.needsOwnerCheck, true);
  assert.equal(price.category, "마케팅");
  // 시설: 70% vs 60% → 차이 10%p, 기준(10) 이상이므로 높음
  const fac = r.findings.find((f) => f.keyword === "시설이 깔끔해요")!;
  assert.equal(fac.type, "높음");
  assert.equal(fac.signalType, "strength_promotion");
  assert.equal(describeFinding(price), "'가격이 합리적이에요' 선택 비율이 20%로, 경쟁 매장 평균(50%)보다 30%p 낮아요.");
});

test("기준 미만 차이는 Finding을 만들지 않는다", () => {
  const mine = place(store(), [["시설이 깔끔해요", 100]]);
  const c = place(store({ placeId: "b" }), [["시설이 깔끔해요", 110]]);
  assert.equal(computeMetrics(mine, [c]).findings.filter((f) => f.keyword).length, 0);
});

test("최소 표본 미만이면 수치 판단을 미룬다", () => {
  const s = store({ visitorReviewCount: THRESHOLDS.minReviews - 1 });
  const r = computeMetrics(place(s, [["가격이 합리적이에요", 1]]), [place(store({ placeId: "b" }), [["가격이 합리적이에요", 100]])]);
  assert.equal(r.insufficientSample, true);
  assert.equal(r.findings.filter((f) => f.keyword || f.signalType === "review_count_low").length, 0);
});

test("리뷰 수 적음 + 별점 높음 신호", () => {
  const mine = place(store({ visitorReviewCount: 100, rating: 4.9 }), []);
  const c = place(store({ placeId: "b", visitorReviewCount: 400 }), []);
  const types = computeMetrics(mine, [c]).findings.map((f) => f.signalType);
  assert.ok(types.includes("review_count_low"));
  assert.ok(types.includes("rating_high_reviews_low"));
  const notFew = computeMetrics(place(store({ visitorReviewCount: 300, rating: 4.9 }), []), [c]).findings.map((f) => f.signalType);
  assert.ok(!notFew.includes("review_count_low"));
});

test("정보 항목 있음/없음과 소개글 없음 신호", () => {
  const r = computeMetrics(place(store({ intro: "", hasBookingTab: false }), []), []);
  assert.equal(r.infoChecks.find((c) => c.item === "소개글")!.present, false);
  assert.equal(r.infoChecks.find((c) => c.item === "예약 탭")!.present, false);
  assert.equal(r.infoChecks.find((c) => c.item === "편의시설 설정")!.present, true);
  assert.ok(r.findings.some((f) => f.signalType === "intro_weak"));
});

test("Finding에는 점수·가중치·순위 필드가 없다", () => {
  const mine = place(store(), [["가격이 합리적이에요", 20]]);
  const c = place(store({ placeId: "b" }), [["가격이 합리적이에요", 150]]);
  for (const f of computeMetrics(mine, [c]).findings) {
    for (const bad of ["score", "weight", "rank", "priority"]) assert.ok(!(bad in f));
  }
});

test("키워드 분류", () => {
  assert.equal(classifyKeyword("가성비가 좋아요"), "가격");
  assert.equal(classifyKeyword("사장님이 친절해요"), "응대");
  assert.equal(classifyKeyword("샤워실이 깨끗해요"), "청결·시설");
  assert.equal(classifyKeyword("주차하기 편해요"), "편의");
  assert.equal(categoryOf("가격"), "마케팅");
  assert.equal(categoryOf("응대"), "비마케팅");
});
