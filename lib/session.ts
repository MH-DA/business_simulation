import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token.ts";
import { getUser, type PublicUser } from "./users.ts";

// 지금 로그인한 회원. 없으면 null. 같은 요청 안에서는 한 번만 조회한다 (머리글과 화면이 같이 불러도).
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const uid = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  try {
    return await getUser(uid);
  } catch (e) {
    console.error("로그인 회원 조회 실패:", e);
    return null;
  }
});

// 아래 두 함수는 Route Handler(API)에서만 부른다. (쿠키 쓰기는 화면 렌더 중에는 할 수 없다)
export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true, // 브라우저 스크립트가 읽지 못하게
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// 로그인이 필요한 화면에서: 로그인 화면 주소 (돌아올 주소 포함)
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;
