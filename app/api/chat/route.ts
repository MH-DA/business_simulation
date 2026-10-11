import { NextResponse } from "next/server";
import { loadKnowledge } from "@/lib/knowledge";
import { runChat, selectGenerate } from "@/lib/llm";
import { resolvePlace } from "@/lib/places";
import { getProvider } from "@/lib/providers";

const MAX_QUESTION = 500;

// POST /api/chat  { placeId, question }
// 응답: text/event-stream. 한 줄이 "data: {ChatEvent JSON}" 이고, 마지막은 type "done" (근거 카드, 확인 카드).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { placeId?: unknown; question?: unknown } | null;
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

  const [competitors, knowledge] = await Promise.all([
    getProvider().getCompetitors(resolved.data.store),
    loadKnowledge(),
  ]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runChat({ question, place: resolved.data, competitors, knowledge, generate })) {
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
