import { NextResponse } from "next/server";
import { saveExchange, type StoredConfirm, type StoredEvidence } from "@/lib/chats";
import { loadKnowledge } from "@/lib/knowledge";
import { runChat, selectGenerate } from "@/lib/llm";
import { resolveCompetitor, resolvePlace } from "@/lib/places";
import { profileLines } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

const MAX_QUESTION = 500;

// POST /api/chat  { placeId, question, profile?, competitorId?, conversationId? }   (로그인 필요)
//   profile = 성향 파악 답 번호 5개 (lib/profile.ts), competitorId = 사장님이 고른 비교 가게 (수집된 가게만 쓴다)
//   conversationId = 이어서 쓸 대화. 없으면 답변이 끝난 뒤 새 대화로 저장한다.
// 응답: text/event-stream. 한 줄이 "data: {ChatEvent JSON}" 이다.
//   답변이 저장되면 "done" 바로 앞에 { type: "conversation", conversation } 이 온다 (왼쪽 목록 갱신용).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "unauthorized", message: "로그인이 필요해요." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as
    | { placeId?: unknown; question?: unknown; profile?: unknown; competitorId?: unknown; conversationId?: unknown }
    | null;
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!placeId || !question) {
    return NextResponse.json({ status: "bad_request", message: "placeId와 question이 필요해요." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION) {
    return NextResponse.json({ status: "bad_request", message: `질문은 ${MAX_QUESTION}자까지 입력할 수 있어요.` }, { status: 400 });
  }

  const generate = selectGenerate();
  if (!generate) {
    return NextResponse.json({ status: "llm_unavailable", message: "챗봇을 준비 중이에요." }, { status: 503 });
  }

  const resolved = await resolvePlace(placeId);
  if (resolved.status === "needs_collection") {
    return NextResponse.json({ status: "needs_collection" }, { status: 404 });
  }

  const competitorId = typeof body?.competitorId === "string" && body.competitorId !== placeId ? body.competitorId : "";
  const [other, knowledge] = await Promise.all([
    competitorId ? resolveCompetitor(competitorId) : Promise.resolve(null),
    loadKnowledge(),
  ]);
  const competitors = other?.status === "ok" ? [other.data] : [];
  const conversationId = typeof body?.conversationId === "string" && body.conversationId ? body.conversationId : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        let answer = "";
        for await (const event of runChat({ question, place: resolved.data, competitors, knowledge, generate, profile: profileLines(body?.profile) })) {
          if (event.type === "delta") {
            answer += event.text;
            send(event);
            continue;
          }
          // 답변이 끝나면 저장하고, 저장된 대화를 먼저 알린 뒤 done 을 보낸다. 저장이 실패해도 답변은 보여준다.
          if (answer.trim()) {
            try {
              const conversation = await saveExchange({
                userId: user.id,
                placeId,
                competitorId: competitorId || undefined,
                conversationId,
                question,
                answer: answer.trim(),
                evidence: event.evidence as StoredEvidence[],
                confirm: event.confirm as StoredConfirm | undefined,
              });
              if (conversation) send({ type: "conversation", conversation });
            } catch (err) {
              console.error("chat save failed:", err);
            }
          }
          send(event);
        }
      } catch (err) {
        // 원인은 서버 로그에만 남기고, 화면에는 일반 안내만 보낸다. (API 키·내부 오류 노출 방지)
        console.error("chat failed:", err);
        send({ type: "error", message: "답변을 만드는 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
