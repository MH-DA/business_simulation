import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.ts";
import { parseSnapshotPayload } from "./snapshots.ts";
import { validateSignup } from "../users.ts";

// 이 테스트는 DB에 접속하지 않는다. (DB가 필요한 부분은 db/schema.sql을 실제 DB에 실행해서 확인한다)

const valid = () => ({
  store: { placeId: "1234567", name: "테스트 카페", industry: "카페", category: "카페", tabs: [], amenities: [], representativeKeywords: [], coupons: [] },
  keywordStats: [],
  reviews: [],
  collectedAt: "2026-11-01T09:00:00+09:00",
  source: "octoparse",
});

test("비밀번호: 같은 비밀번호만 통과하고, 해시에 평문이 들어 있지 않다", async () => {
  const stored = await hashPassword("correct-horse-1");
  assert.ok(stored.startsWith("scrypt$"));
  assert.ok(!stored.includes("correct-horse-1"));
  assert.equal(await verifyPassword("correct-horse-1", stored), true);
  assert.equal(await verifyPassword("correct-horse-2", stored), false);
});

test("비밀번호: 같은 비밀번호도 해시는 매번 다르다 (salt)", async () => {
  assert.notEqual(await hashPassword("same-password-1"), await hashPassword("same-password-1"));
});

test("비밀번호: 깨진 해시는 예외 없이 false", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "plain-text"), false);
  assert.equal(await verifyPassword("x", "scrypt$abc$AA$AA"), false);
});

test("회원가입 검사: 아이디·비밀번호·이름 규칙", () => {
  const ok = { loginId: "owner_01", password: "abcd1234", displayName: "민혁" };
  assert.equal(validateSignup(ok), undefined);
  assert.match(validateSignup({ ...ok, loginId: "ab" }) ?? "", /아이디/);
  assert.match(validateSignup({ ...ok, loginId: "한글아이디" }) ?? "", /아이디/);
  assert.match(validateSignup({ ...ok, password: "short" }) ?? "", /비밀번호/);
  assert.match(validateSignup({ ...ok, password: "a".repeat(129) }) ?? "", /비밀번호/);
  assert.match(validateSignup({ ...ok, displayName: "   " }) ?? "", /이름/);
});

test("스냅샷 payload: 올바른 모양은 그대로 통과 (값을 고치지 않는다)", () => {
  const raw = valid();
  assert.equal(parseSnapshotPayload(raw), raw as unknown);
});

test("스냅샷 payload: 모양이 틀리면 이유를 알려 주고 멈춘다", () => {
  assert.throws(() => parseSnapshotPayload(null), /JSON 객체/);
  assert.throws(() => parseSnapshotPayload([]), /JSON 객체/);
  assert.throws(() => parseSnapshotPayload({ ...valid(), store: undefined }), /store/);
  assert.throws(() => parseSnapshotPayload({ ...valid(), store: { ...valid().store, placeId: "" } }), /placeId/);
  assert.throws(() => parseSnapshotPayload({ ...valid(), store: { ...valid().store, industry: "분식" } }), /industry/);
  assert.throws(() => parseSnapshotPayload({ ...valid(), reviews: {} }), /reviews/);
  assert.throws(() => parseSnapshotPayload({ ...valid(), collectedAt: "어제" }), /collectedAt/);
  assert.throws(() => parseSnapshotPayload({ ...valid(), source: "scraper" }), /source/);
});
