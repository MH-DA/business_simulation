import { NextResponse } from "next/server";
import { endSession } from "@/lib/session";

// POST /api/auth/logout → 로그인 쿠키 삭제
export async function POST() {
  await endSession();
  return NextResponse.json({ ok: true });
}
