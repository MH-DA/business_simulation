import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_MAX_AGE, safeNext, signSession, verifySession } from "./session-token.ts";

const SECRET = "x".repeat(40);

test("로그인 쿠키: 서명이 맞고 기간 안이면 회원 id를 돌려준다", () => {
  const now = Date.UTC(2026, 10, 11);
  const token = signSession("user-1", now, SECRET);
  assert.equal(verifySession(token, now + 1000, SECRET), "user-1");
});

test("로그인 쿠키: 기간이 지나거나, 고쳐졌거나, 다른 비밀값이면 거절한다", () => {
  const now = Date.UTC(2026, 10, 11);
  const token = signSession("user-1", now, SECRET);
  assert.equal(verifySession(token, now + (SESSION_MAX_AGE + 1) * 1000, SECRET), null);
  assert.equal(verifySession(token, now, "y".repeat(40)), null);
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: 9e9 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${sig}`, now, SECRET), null);
  assert.equal(verifySession(`${payload}.${sig}.x`, now, SECRET), null);
  assert.equal(verifySession(undefined, now, SECRET), null);
  assert.equal(verifySession("garbage", now, SECRET), null);
});

test("로그인 뒤 돌아갈 주소: 우리 사이트 안 경로만 허용한다", () => {
  assert.equal(safeNext("/result/123"), "/result/123");
  assert.equal(safeNext("/consult/1?with=2"), "/consult/1?with=2");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "", undefined, ["/a"]]) assert.equal(safeNext(bad), "/");
});
