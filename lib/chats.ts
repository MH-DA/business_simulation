import type postgres from "postgres";
import { getSql } from "./db/index.ts";
import { isMemoryMode, memory, type MemoryConversation, type MemoryMessage } from "./memory-store.ts";

// 상담 기록: 대화(conversations) 한 개에 질문·답변(chat_messages)이 쌓인다. (db/schema.sql 7·8번 표)
// 상담 화면 왼쪽 목록에 "이전 대화"로 보여준다. 다른 회원의 대화는 읽을 수 없다 (모든 조회에 user_id 조건).
// DATABASE_URL 이 없으면(개발 중) 서버 메모리에 잠깐 보관한다.

export type ConversationSummary = { id: string; placeId: string; title: string; updatedAt: string };
export type StoredEvidence = { id: string; knowledgeId: string; title: string; summary: string; strength: "강함" | "중간" | "혼재" };
export type StoredConfirm = { question: string; buttons: string[] };
export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  evidence: StoredEvidence[];
  confirm?: StoredConfirm;
  createdAt: string;
};

export const TITLE_MAX = 40;
const LIST_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 대화 제목 = 첫 질문 앞부분 (LLM이 만들지 않는다)
export function titleOf(question: string): string {
  const one = question.replace(/\s+/g, " ").trim();
  return one.length > TITLE_MAX ? `${one.slice(0, TITLE_MAX - 1)}…` : one;
}

type ConvRow = { id: string; place_id: string; title: string; updated_at: Date };
type MsgRow = { role: "user" | "assistant"; content: string; evidence: unknown; confirm: unknown; created_at: Date };

const toSummary = (r: ConvRow | MemoryConversation): ConversationSummary => ({
  id: r.id,
  placeId: r.place_id,
  title: r.title,
  updatedAt: new Date(r.updated_at).toISOString(),
});

const toMessage = (r: MsgRow | MemoryMessage): StoredMessage => ({
  role: r.role,
  content: r.content,
  evidence: Array.isArray(r.evidence) ? (r.evidence as StoredEvidence[]) : [],
  ...(r.confirm && typeof r.confirm === "object" ? { confirm: r.confirm as StoredConfirm } : {}),
  createdAt: new Date(r.created_at).toISOString(),
});

// 이 회원이 이 가게에 대해 나눈 대화 목록 (최근 것부터)
export async function listConversations(userId: string, placeId: string): Promise<ConversationSummary[]> {
  if (isMemoryMode()) {
    return memory.conversations
      .filter((c) => c.user_id === userId && c.place_id === placeId)
      .sort((a, b) => +b.updated_at - +a.updated_at)
      .slice(0, LIST_LIMIT)
      .map(toSummary);
  }
  const sql = getSql();
  const rows = await sql<ConvRow[]>`
    select id, place_id, title, updated_at from conversations
    where user_id = ${userId} and place_id = ${placeId}
    order by updated_at desc
    limit ${LIST_LIMIT}`;
  return rows.map(toSummary);
}

// 대화 한 개와 메시지. 다른 회원의 대화거나 없으면 null.
export async function getConversation(
  userId: string,
  id: string,
): Promise<{ summary: ConversationSummary; messages: StoredMessage[] } | null> {
  if (!UUID.test(id)) return null;
  if (isMemoryMode()) {
    const conv = memory.conversations.find((c) => c.id === id && c.user_id === userId);
    if (!conv) return null;
    const msgs = memory.messages.filter((m) => m.conversation_id === id).sort((a, b) => +a.created_at - +b.created_at);
    return { summary: toSummary(conv), messages: msgs.map(toMessage) };
  }
  const sql = getSql();
  const convs = await sql<ConvRow[]>`
    select id, place_id, title, updated_at from conversations where id = ${id} and user_id = ${userId}`;
  if (!convs[0]) return null;
  const msgs = await sql<MsgRow[]>`
    select role, content, evidence, confirm, created_at from chat_messages
    where conversation_id = ${id}
    order by created_at, id`;
  return { summary: toSummary(convs[0]), messages: msgs.map(toMessage) };
}

export type Exchange = {
  userId: string;
  placeId: string;
  competitorId?: string;
  conversationId?: string; // 없으면 새 대화를 만든다
  question: string;
  answer: string;
  evidence: StoredEvidence[];
  confirm?: StoredConfirm;
};

// 질문 하나와 답변 하나를 저장한다. 새 대화면 대화도 만든다. 저장된 대화 요약을 돌려준다.
// 이어 쓰는 대화가 이 회원의 것이 아니면 저장하지 않고 null.
export async function saveExchange(x: Exchange): Promise<ConversationSummary | null> {
  if (x.conversationId && !UUID.test(x.conversationId)) return null;
  if (isMemoryMode()) return saveExchangeMemory(x);
  const sql = getSql();
  return sql.begin(async (tx) => {
    let conv: ConvRow | undefined;
    if (x.conversationId) {
      [conv] = await tx<ConvRow[]>`
        update conversations set updated_at = now()
        where id = ${x.conversationId} and user_id = ${x.userId}
        returning id, place_id, title, updated_at`;
      if (!conv) return null;
    } else {
      [conv] = await tx<ConvRow[]>`
        insert into conversations (user_id, place_id, competitor_id, title)
        values (${x.userId}, ${x.placeId}, ${x.competitorId ?? null}, ${titleOf(x.question)})
        returning id, place_id, title, updated_at`;
    }
    const json = (v: unknown) => tx.json(v as postgres.JSONValue);
    // 질문과 답변의 순서가 바뀌지 않게 시각을 1ms 차이로 넣는다
    await tx`
      insert into chat_messages (conversation_id, role, content, evidence, confirm, created_at) values
        (${conv.id}, 'user', ${x.question}, ${json([])}, null, clock_timestamp()),
        (${conv.id}, 'assistant', ${x.answer}, ${json(x.evidence)}, ${x.confirm ? json(x.confirm) : null}, clock_timestamp() + interval '1 millisecond')`;
    return toSummary(conv);
  });
}

function saveExchangeMemory(x: Exchange): ConversationSummary | null {
  const now = new Date();
  let conv = x.conversationId ? memory.conversations.find((c) => c.id === x.conversationId && c.user_id === x.userId) : undefined;
  if (x.conversationId && !conv) return null;
  if (!conv) {
    conv = {
      id: crypto.randomUUID(),
      user_id: x.userId,
      place_id: x.placeId,
      competitor_id: x.competitorId ?? null,
      title: titleOf(x.question),
      created_at: now,
      updated_at: now,
    };
    memory.conversations.push(conv);
  }
  conv.updated_at = now;
  memory.messages.push(
    { id: crypto.randomUUID(), conversation_id: conv.id, role: "user", content: x.question, evidence: [], confirm: null, created_at: now },
    {
      id: crypto.randomUUID(),
      conversation_id: conv.id,
      role: "assistant",
      content: x.answer,
      evidence: x.evidence,
      confirm: x.confirm ?? null,
      created_at: new Date(now.getTime() + 1),
    },
  );
  return toSummary(conv);
}
