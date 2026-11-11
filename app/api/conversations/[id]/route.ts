import { NextResponse } from "next/server";
import { getConversation } from "@/lib/chats";
import { getCurrentUser } from "@/lib/session";

// GET /api/conversations/:id → { summary, messages }  (로그인한 회원 자신의 대화만)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
  const { id } = await params;
  const found = await getConversation(user.id, id);
  if (!found) return NextResponse.json({ message: "대화를 찾지 못했어요." }, { status: 404 });
  return NextResponse.json(found);
}
