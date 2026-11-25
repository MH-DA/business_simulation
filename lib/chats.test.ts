import assert from "node:assert/strict";
import { test } from "node:test";
import { getConversation, listConversations, saveExchange, titleOf } from "./chats.ts";

// DATABASE_URL 이 없으면 메모리 보관소를 쓴다 (DB 없이 시험)
const ev = [{ id: "c1", knowledgeId: "K-retention-01", title: "재방문", summary: "요약", strength: "강함" as const }];

test("상담 기록: 새 대화를 만들고, 같은 대화에 이어서 쌓는다", async () => {
  const first = await saveExchange({ userId: "u1", placeId: "p1", question: "재방문을 늘리려면?", answer: "답1", evidence: ev });
  assert.ok(first);
  assert.equal(first.title, "재방문을 늘리려면?");
  const again = await saveExchange({ userId: "u1", placeId: "p1", conversationId: first.id, question: "쿠폰은요?", answer: "답2", evidence: [], confirm: { question: "쿠폰이 있나요?", buttons: ["예", "아니요"] } });
  assert.equal(again?.id, first.id);

  const found = await getConversation("u1", first.id);
  assert.deepEqual(found?.messages.map((m) => [m.role, m.content]), [["user", "재방문을 늘리려면?"], ["assistant", "답1"], ["user", "쿠폰은요?"], ["assistant", "답2"]]);
  assert.equal(found?.messages[1].evidence[0].knowledgeId, "K-retention-01");
  assert.deepEqual(found?.messages[3].confirm?.buttons, ["예", "아니요"]);
});

test("상담 기록: 다른 회원의 대화는 읽거나 이어 쓸 수 없다", async () => {
  const mine = await saveExchange({ userId: "u2", placeId: "p1", question: "질문", answer: "답", evidence: [] });
  assert.ok(mine);
  assert.equal(await getConversation("someone-else", mine.id), null);
  assert.equal(await saveExchange({ userId: "someone-else", placeId: "p1", conversationId: mine.id, question: "q", answer: "a", evidence: [] }), null);
  assert.equal(await getConversation("u2", "not-a-uuid"), null);
});

test("상담 기록: 목록은 이 회원·이 가게 것만, 최근 대화부터", async () => {
  const a = await saveExchange({ userId: "u3", placeId: "p1", question: "첫 대화", answer: "답", evidence: [] });
  await new Promise((r) => setTimeout(r, 5));
  const b = await saveExchange({ userId: "u3", placeId: "p1", question: "둘째 대화", answer: "답", evidence: [] });
  await saveExchange({ userId: "u3", placeId: "p2", question: "다른 가게", answer: "답", evidence: [] });
  const list = await listConversations("u3", "p1");
  assert.deepEqual(list.map((c) => c.id), [b?.id, a?.id]);
});

test("대화 제목: 첫 질문 앞부분 40자까지", () => {
  assert.equal(titleOf("  여러   칸  띄어쓰기  "), "여러 칸 띄어쓰기");
  const long = "가".repeat(60);
  assert.equal(titleOf(long).length, 40);
  assert.ok(titleOf(long).endsWith("…"));
});
