import { createHmac, timingSafeEqual } from "node:crypto";

// 로그인 유지 쿠키. 값 = base64url({uid, exp}) + "." + 서명(HMAC-SHA256).
// 서명이 맞고 기간이 남아 있을 때만 그 회원으로 본다. 쿠키에는 회원 id와 만료 시각만 들어간다(비밀번호·이름 없음).
// 이 파일은 next/* 를 쓰지 않는다 (node --test 로 바로 시험할 수 있게).
export const SESSION_COOKIE = "placement_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14일

const DEV_SECRET = "dev-only-placement-session-secret-do-not-use-in-prod";

// 배포(production)에서는 SESSION_SECRET(32자 이상)이 꼭 있어야 한다. 개발 중에는 없으면 개발용 값을 쓴다.
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET 이 없거나 너무 짧아요. 32자 이상의 임의 문자열을 환경변수에 넣어 주세요.");
  }
  return DEV_SECRET;
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest();

export function signSession(userId: string, now = Date.now(), secret = sessionSecret()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Math.floor(now / 1000) + SESSION_MAX_AGE })).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

// 맞으면 회원 id, 아니면 null (서명 틀림, 기간 지남, 모양 틀림)
export function verifySession(token: string | undefined, now = Date.now(), secret = sessionSecret()): string | null {
  if (!token) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expected = sign(payload, secret);
  const actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as { uid?: unknown; exp?: unknown };
    if (typeof data.uid === "string" && data.uid && typeof data.exp === "number" && data.exp * 1000 > now) return data.uid;
  } catch {
    /* 모양이 틀린 쿠키 */
  }
  return null;
}

// 로그인 뒤 돌아갈 주소. 우리 사이트 안의 경로만 허용한다 (다른 사이트로 보내는 주소 차단).
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
