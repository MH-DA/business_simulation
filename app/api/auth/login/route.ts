import { NextResponse } from "next/server";
import { startSession } from "@/lib/session";
import { verifyLogin } from "@/lib/users";

// POST /api/auth/login  { loginId, password }
// 아이디와 비밀번호 중 어느 쪽이 틀렸는지는 알려 주지 않는다.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { loginId?: unknown; password?: unknown } | null;
  const loginId = typeof b?.loginId === "string" ? b.loginId.trim() : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!loginId || !password) return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });

  try {
    const user = await verifyLogin(loginId, password);
    if (!user) return NextResponse.json({ message: "아이디 또는 비밀번호가 맞지 않아요." }, { status: 401 });
    await startSession(user.id);
    return NextResponse.json({ user: { loginId: user.loginId, displayName: user.displayName } });
  } catch (e) {
    console.error("login failed:", e);
    return NextResponse.json({ message: "로그인 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
  }
}
