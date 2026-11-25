import { NextResponse } from "next/server";
import { startSession } from "@/lib/session";
import { createUser, LOGIN_ID_RULE, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/users";

type Field = "loginId" | "password" | "passwordConfirm" | "displayName";
const fail = (status: number, field: Field | undefined, message: string) => NextResponse.json({ field, message }, { status });

// POST /api/auth/signup  { loginId, password, passwordConfirm, displayName } → 가입하고 바로 로그인
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof b?.[k] === "string" ? (b[k] as string) : "");
  const loginId = str("loginId").trim();
  const password = str("password");
  const displayName = str("displayName");

  // 어느 칸이 틀렸는지 알려 주려고 칸별로 먼저 본다. (최종 검사는 createUser 의 validateSignup)
  if (!LOGIN_ID_RULE.test(loginId)) return fail(400, "loginId", "아이디는 영문, 숫자, 점(.), 밑줄(_), 하이픈(-)으로 3~40자여야 해요.");
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return fail(400, "password", `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해 주세요.`);
  }
  if (password !== str("passwordConfirm")) return fail(400, "passwordConfirm", "비밀번호가 일치하지 않아요.");
  if (!displayName.trim() || displayName.trim().length > 30) return fail(400, "displayName", "사용자 이름은 1~30자로 입력해 주세요.");

  try {
    const result = await createUser({ loginId, password, displayName });
    if (!result.ok) return fail(result.reason === "taken" ? 409 : 400, result.reason === "taken" ? "loginId" : undefined, result.message);
    await startSession(result.user.id);
    return NextResponse.json({ user: { loginId: result.user.loginId, displayName: result.user.displayName } });
  } catch (e) {
    console.error("signup failed:", e);
    return fail(500, undefined, "가입 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.");
  }
}
