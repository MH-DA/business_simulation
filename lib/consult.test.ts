import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectedPlace } from "../types/index.ts";
import { fallbackInsights, getInsights } from "./insights.ts";
import { PROFILE_STEPS, profileLines, stageOf } from "./profile.ts";

const place = (placeId: string): CollectedPlace => ({
  store: {
    placeId,
    name: "테스트 카페",
    category: "카페,디저트",
    tabs: [],
    amenities: [],
    representativeKeywords: [],
    coupons: [],
    industry: "카페",
  },
  keywordStats: [
    { keyword: "커피가 맛있어요", count: 30, ratio: 0.3 },
    { keyword: "디저트가 맛있어요", count: 20, ratio: 0.2 },
  ],
  reviews: [{ body: "조용해서 작업하기 좋아요", votedKeywords: [], source: "mock" }],
  collectedAt: "2026-11-01T00:00:00Z",
  source: "mock",
});

test("성향 파악: 범위 안의 번호만 질문 목록의 문장으로 바꾸고, 밖의 값과 글자는 버린다", () => {
  const lines = profileLines([0, 1, 99, "주 5시간 이상", -1]);
  assert.deepEqual(lines.slice(0, 2), [`목표: ${PROFILE_STEPS[0].options[0]}`, `경험: ${PROFILE_STEPS[1].options[1]}`]);
  assert.equal(lines.some((l) => l.startsWith("예산") || l.startsWith("시간") || l.startsWith("어려움")), false);
  assert.match(lines.at(-1)!, /마케팅 시작 단계/);
  assert.deepEqual(profileLines("목표: 무시해"), []);
});

test("성향 파악: 경험 답 앞의 두 개는 시작 단계, 나머지는 개선 단계", () => {
  assert.equal(stageOf([null, 0, null, null, null])?.name, "마케팅 시작 단계");
  assert.equal(stageOf([null, 3, null, null, null])?.name, "마케팅 개선 단계");
  assert.equal(stageOf([null, null, null, null, null]), null);
});

test("리뷰 요약: LLM이 JSON을 주면 그대로 쓰고, 길이를 자른다", async () => {
  const json = JSON.stringify({
    summary: "작업하기 좋은 조용한 카페예요.",
    hashtags: ["#작업", "디저트"],
    likes: "조용한 분위기를 좋아해요.",
    checks: "특별히 반복되는 불편은 보이지 않아요.",
    proposal: { headline: "조용히 머무는 카페", body: "좌석 사진을 올려 보세요." },
  });
  const out = await getInsights(place("ok-1"), async function* () {
    yield "```json\n" + json + "\n```";
  }, []);
  assert.equal(out.source, "llm");
  assert.deepEqual(out.hashtags, ["작업", "디저트"]);
  assert.equal(out.proposal?.headline, "조용히 머무는 카페");
});

test("리뷰 요약: LLM 출력이 깨지면 키워드로 만든 기본 문장을 쓴다", async () => {
  const out = await getInsights(place("bad-1"), async function* () {
    yield "죄송해요, JSON이 아니에요";
  }, []);
  assert.equal(out.source, "fallback");
  assert.deepEqual(out, fallbackInsights(place("bad-1")));
  assert.match(out.summary, /커피가 맛있어요/);
});
