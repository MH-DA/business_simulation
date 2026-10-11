import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CollectedPlace, Guardrail, KnowledgeChunk, Store } from "../../types/index.ts";
import { searchKnowledge } from "../knowledge/search.ts";
import { buildComparison, daysSince } from "../metrics/comparison.ts";
import { runChat, type ChatEvent, type Generate } from "./chat.ts";
import { classifyQuestion, topicSignals } from "./intent.ts";
import { MarkerFilter, parseOutput } from "./output.ts";
import { buildPrompt } from "./prompt.ts";
import { FAQ } from "../sample-chat.ts";

const chunks = JSON.parse(readFileSync("data/knowledge/principles.json", "utf-8")) as KnowledgeChunk[];
const guardrails = JSON.parse(readFileSync("data/knowledge/guardrails.json", "utf-8")) as Guardrail[];

function store(over: Partial<Store> = {}): Store {
  return {
    placeId: "a", name: "우리 가게", category: "헬스장", tabs: ["예약"], amenities: ["주차"], representativeKeywords: [],
    coupons: [], industry: "헬스장", visitorReviewCount: 200, blogReviewCount: 10, rating: 4.9, intro: "소개글", hasBookingTab: true, ...over,
  };
}
function place(s: Store): CollectedPlace {
  return { store: s, keywordStats: [], reviews: [], collectedAt: "2026-10-10T00:00:00Z", source: "mock" };
}
async function collect(gen: AsyncGenerator<ChatEvent>) {
  const events: ChatEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

test("질문 분류: 자주 묻는 질문 4개가 각자 의도로 분류된다", () => {
  const intents = FAQ.map((q) => classifyQuestion(q).intent);
  assert.deepEqual(intents, ["new_customer", "retention", "strength_promotion", "complaint_improve"]);
  assert.ok(FAQ.every((q) => classifyQuestion(q).type === "실행안 생성"));
});

test("질문 분류: 판단을 구하는 질문은 판단 보조형, 이유를 묻는 질문은 진단 설명형", () => {
  assert.equal(classifyQuestion("쿠폰을 뿌려도 될까요?").type, "판단 보조");
  assert.equal(classifyQuestion("리뷰가 왜 적은 건가요?").type, "진단 설명");
  assert.equal(classifyQuestion("안녕하세요").intent, null);
});

test("지식 검색: 신호가 맞는 조각만, 묶음 가중치가 높은 순으로 최대 3개", () => {
  const tiers = [
    { signals: ["retention"], weight: 3 },
    { signals: ["coupon_missing"], weight: 1 },
  ];
  const found = searchKnowledge(chunks, { tiers, industry: "헬스장" });
  assert.ok(found.length <= 3 && found.length > 0);
  assert.ok(found.every((c) => c.signalTypes.some((s) => s === "retention" || s === "coupon_missing")));
  const both = chunks.filter((c) => c.signalTypes.includes("retention") && c.signalTypes.includes("coupon_missing")).map((c) => c.id);
  assert.ok(both.includes(found[0].id)); // 두 묶음에 모두 걸린 조각이 먼저 나온다
  assert.deepEqual(searchKnowledge(chunks, { tiers: [{ signals: ["없는_신호"], weight: 1 }], industry: "헬스장" }), []);
});

test("지식 검색: 질문에 쿠폰이 나오면 쿠폰 조각이 비교 사실(리뷰 수)보다 먼저 나온다", () => {
  const tiers = [
    { signals: topicSignals("쿠폰을 뿌려도 될까요?"), weight: 2 },
    { signals: ["review_count_low"], weight: 1 },
  ];
  const found = searchKnowledge(chunks, { tiers, industry: "헬스장" });
  assert.ok(found[0].signalTypes.some((s) => ["coupon_missing", "coupon_exists_retention_low", "promotion_timing"].includes(s)));
});

test("지식 검색: 불편 개선 질문은 의도 조각이 단순 주제어 조각보다 먼저 나온다", () => {
  const q = "리뷰의 불편 사항을 어떻게 개선하면 좋을까요?";
  const tiers = [
    { signals: ["complaint_improve"], weight: 3 },
    { signals: topicSignals(q), weight: 2 },
    { signals: ["review_count_low"], weight: 1 },
  ];
  const found = searchKnowledge(chunks, { tiers, industry: "헬스장" });
  assert.ok(found.slice(0, 3).every((c) => c.signalTypes.includes("complaint_improve") || c.id.startsWith("K-trust")));
  assert.ok(found[0].signalTypes.includes("complaint_improve"));
});

test("비교: 9개 항목을 두 가게 값으로 나란히 놓고, 판정·평균은 만들지 않는다", () => {
  const c = buildComparison(store(), store({ name: "1위 가게", rating: 4.8, visitorReviewCount: 400, coupons: ["쿠폰"] }), "2026-10-10T00:00:00Z");
  assert.equal(c.rows.length, 9);
  assert.deepEqual(c.rows[1], { item: "방문자 리뷰 수", mine: "200", top: "400" });
  assert.deepEqual(c.rows[5], { item: "쿠폰", mine: "없음", top: "있음" });
  assert.deepEqual(c.rows[7], { item: "네이버페이", mine: "수집 전", top: "수집 전" });
  assert.ok(c.signalTags.includes("coupon_missing") && c.signalTags.includes("review_count_low"));
});

test("비교: 1위 가게가 없으면 비교 대상 없음으로 표시한다", () => {
  const c = buildComparison(store(), undefined, "2026-10-10T00:00:00Z");
  assert.ok(c.rows.every((r) => r.top === "비교 대상 없음"));
  assert.equal(c.topName, undefined);
});

test("새소식 경과일은 수집 시점 기준이다", () => {
  assert.equal(daysSince("2026-10-01T00:00:00Z", "2026-10-10T12:00:00Z"), 9);
  assert.equal(daysSince(undefined, "2026-10-10T00:00:00Z"), undefined);
  const c = buildComparison(
    store({ lastNewsDate: "2026-08-01T00:00:00Z" }),
    store({ name: "1위", lastNewsDate: "2026-10-05T00:00:00Z" }),
    "2026-10-10T00:00:00Z",
  );
  assert.equal(c.rows[8].top, "5일 전");
  assert.ok(c.signalTags.includes("news_inactive"));
});

test("프롬프트: 공통 규칙, 가드레일 전부, 비교 사실, 지식 ID가 들어간다", () => {
  const comparison = buildComparison(store(), store({ name: "1위 가게" }), "2026-10-10T00:00:00Z");
  const p = buildPrompt({ question: "질문", type: "판단 보조", storeName: "우리 가게", industry: "헬스장", comparison, chunks: chunks.slice(0, 2), guardrails });
  for (const g of guardrails) assert.ok(p.system.includes(g.id), `${g.id} 누락`);
  assert.ok(p.system.includes("점수, 순위"));
  assert.ok(p.system.includes("결론(해도 된다/안 된다)을 내리지 않는다"));
  assert.ok(p.user.includes("| 별점 | 4.9 | 4.9 |"));
  assert.ok(p.user.includes(`[${chunks[0].id}]`));
});

test("출력 표시: 본문과 [[근거]]·[[확인]] 줄을 나눈다", () => {
  const out = parseOutput("본문이에요.\n\n[[근거: K-trust-01, K-trust-01, 엉터리]]\n[[확인: 지금 쿠폰이 있나요? | 네 | 아니요]]");
  assert.equal(out.answer, "본문이에요.");
  assert.deepEqual(out.usedIds, ["K-trust-01"]);
  assert.deepEqual(out.confirm, { question: "지금 쿠폰이 있나요?", buttons: ["네", "아니요"] });
});

test("스트리밍 필터: 표시 줄은 조각이 어떻게 쪼개져도 화면으로 새지 않는다", () => {
  const text = "첫 문장이에요. 둘째 문장이에요.\n[[근거: K-trust-01]]\n[[확인: 질문 | 네]]";
  for (const size of [1, 3, 7, text.length]) {
    const f = new MarkerFilter();
    let shown = "";
    for (let i = 0; i < text.length; i += size) shown += f.push(text.slice(i, i + size));
    assert.equal(shown.trim(), "첫 문장이에요. 둘째 문장이에요.", `조각 크기 ${size}`);
  }
});

test("챗봇: 검색 결과에 없는 지식 ID는 근거 카드에서 걸러진다", async () => {
  const mine = place(store());
  const top = place(store({ placeId: "b", name: "1위 가게", coupons: ["쿠폰"] }));
  const retrieved = searchKnowledge(chunks, {
    tiers: [{ signals: ["retention"], weight: 3 }, { signals: ["coupon_missing"], weight: 1 }],
    industry: "헬스장",
  });
  const real = retrieved[0].id;
  const generate: Generate = async function* () {
    yield "재방문을 늘리는 방법이에요.\n";
    yield `[[근거: ${real}, K-fake-99]]`;
  };
  const events = await collect(runChat({ question: "재방문을 유도하려면 어떤 전략을 써야 하나요?", place: mine, competitors: [top], knowledge: { chunks, guardrails }, generate }));
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  if (done?.type !== "done") return;
  assert.deepEqual(done.evidence.map((e) => e.knowledgeId), [real]);
  assert.equal(events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("").trim(), "재방문을 늘리는 방법이에요.");
  assert.equal(done.confirm, undefined);
});

test("챗봇: 판단 보조형은 확인 카드로 끝난다 (LLM이 빠뜨리면 기본 확인 카드)", async () => {
  const generate: Generate = async function* () {
    yield "근거만 정리해 드릴게요.";
  };
  const events = await collect(runChat({ question: "쿠폰을 뿌려도 될까요?", place: place(store()), competitors: [], knowledge: { chunks, guardrails }, generate }));
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  if (done?.type === "done") assert.ok(done.confirm && done.confirm.buttons.length === 3);
});
