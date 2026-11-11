import assert from "node:assert/strict";
import { test } from "node:test";
import type { Store } from "../../types/index.ts";
import { buildComparison, buildDifferences } from "./comparison.ts";

const base: Store = {
  placeId: "a", name: "A", category: "카페", tabs: [], amenities: [], representativeKeywords: [], coupons: [], industry: "카페",
};

test("두 가게의 차이: 더 많거나 있거나 더 최근인 쪽에 넣는다", () => {
  const mine: Store = { ...base, rating: 4.7, visitorReviewCount: 128, coupons: ["10% 할인"], lastNewsDate: "2026-11-01" };
  const other: Store = { ...base, placeId: "b", rating: 4.5, visitorReviewCount: 210, coupons: [], lastNewsDate: "2026-10-01" };
  const d = buildDifferences(mine, other);
  assert.deepEqual(d.mine.map((x) => x.item), ["별점", "쿠폰", "최근 새소식"]);
  assert.deepEqual(d.other.map((x) => x.item), ["방문자 리뷰 수"]);
  assert.deepEqual(d.mine[0], { item: "별점", mine: "★ 4.7", other: "★ 4.5" });
  assert.equal(d.other[0].other, "210개");
});

test("두 가게의 차이: 한쪽이 수집 전이거나 값이 같으면 넣지 않는다", () => {
  const mine: Store = { ...base, rating: 4.5, hasNaverPay: true };
  const other: Store = { ...base, placeId: "b", rating: 4.5, blogReviewCount: 30 };
  const d = buildDifferences(mine, other);
  assert.deepEqual(d, { mine: [], other: [] });
});

test("두 가게의 차이에는 판정·점수 문구가 없다", () => {
  const d = buildDifferences({ ...base, rating: 5 }, { ...base, placeId: "b", rating: 3 });
  const text = JSON.stringify(d);
  for (const bad of ["강점", "약점", "부족", "점수", "순위"]) assert.ok(!text.includes(bad));
});

test("수집하지 못한 항목은 '없음'이 아니라 '수집 전'으로 비교하고 신호도 만들지 않는다", () => {
  const mine: Store = { ...base, intro: undefined, coupons: [], unchecked: ["intro", "coupons", "tabs"] };
  const other: Store = { ...base, placeId: "b", intro: "소개", coupons: ["10%"], tabs: ["예약"] };
  const c = buildComparison(mine, other, "2026-11-09");
  const row = (item: string) => c.rows.find((r) => r.item === item)!;
  assert.equal(row("소개글").mine, "수집 전");
  assert.equal(row("쿠폰").mine, "수집 전");
  assert.equal(row("예약 탭").mine, "수집 전");
  assert.equal(row("소개글").top, "있음");
  assert.ok(!c.signalTags.includes("coupon_missing"));
  assert.ok(!c.signalTags.includes("intro_weak"));
  assert.deepEqual(buildDifferences(mine, other).other, []); // 수집 전 항목은 차이로 세지 않는다
});

test("쿠폰: 수집기가 확인한 쿠폰 유무(hasCoupon)를 쿠폰 목록보다 먼저 쓴다", () => {
  const mine: Store = { ...base, hasCoupon: true };
  const other: Store = { ...base, placeId: "b", hasCoupon: false, coupons: [] };
  const d = buildDifferences(mine, other);
  assert.deepEqual(d.mine.map((x) => x.item), ["쿠폰"]);
});
