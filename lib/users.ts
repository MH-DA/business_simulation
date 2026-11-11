import { getSql } from "./db/index.ts";
import { hashPassword, verifyPassword } from "./db/password.ts";

// users 표 연결 (회원가입·로그인 화면: Figma 01·02 = 아이디, 비밀번호, 비밀번호 확인, 사용자 이름)
// 비밀번호 해시는 이 파일 밖으로 나가지 않는다. 화면과 API에는 PublicUser만 넘긴다.
export type PublicUser = { id: string; loginId: string; displayName: string };

type UserRow = { id: string; login_id: string; display_name: string; password_hash: string };

const toPublic = (r: UserRow): PublicUser => ({ id: r.id, loginId: r.login_id, displayName: r.display_name });

export const LOGIN_ID_RULE = /^[A-Za-z0-9._-]{3,40}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128; // 너무 긴 입력으로 서버를 느리게 만드는 것을 막는다

export type SignupInput = { loginId: string; password: string; displayName: string };

// 입력 검사. 문제가 있으면 사장님께 보여줄 문구를 돌려주고, 없으면 undefined.
export function validateSignup(i: SignupInput): string | undefined {
  if (!LOGIN_ID_RULE.test(i.loginId)) return "아이디는 영문, 숫자, 점(.), 밑줄(_), 하이픈(-)으로 3~40자여야 해요.";
  if (i.password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`;
  if (i.password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자 이하여야 해요.`;
  const name = i.displayName.trim();
  if (name.length < 1 || name.length > 30) return "사용자 이름은 1~30자로 입력해 주세요.";
  return undefined;
}

export type CreateUserResult =
  | { ok: true; user: PublicUser }
  | { ok: false; reason: "invalid" | "taken"; message: string };

export async function createUser(input: SignupInput): Promise<CreateUserResult> {
  const message = validateSignup(input);
  if (message) return { ok: false, reason: "invalid", message };
  const sql = getSql();
  const passwordHash = await hashPassword(input.password);
  try {
    const rows = await sql<UserRow[]>`
      insert into users (login_id, password_hash, display_name)
      values (${input.loginId}, ${passwordHash}, ${input.displayName.trim()})
      returning id, login_id, display_name, password_hash`;
    return { ok: true, user: toPublic(rows[0]) };
  } catch (e) {
    // 23505 = 같은 아이디가 이미 있음 (users_login_id_key, 대소문자 구분 없음)
    if ((e as { code?: string }).code === "23505") {
      return { ok: false, reason: "taken", message: "이미 사용 중인 아이디예요." };
    }
    throw e;
  }
}

// 아이디와 비밀번호가 맞으면 회원 정보, 아니면 null. 어느 쪽이 틀렸는지는 알려 주지 않는다.
export async function verifyLogin(loginId: string, password: string): Promise<PublicUser | null> {
  if (!LOGIN_ID_RULE.test(loginId) || password.length > PASSWORD_MAX) return null;
  const sql = getSql();
  const rows = await sql<UserRow[]>`
    select id, login_id, display_name, password_hash from users where lower(login_id) = lower(${loginId})`;
  const row = rows[0];
  // 없는 아이디여도 해시 계산을 한 번 해서, 응답 시간으로 아이디 존재 여부를 알아내지 못하게 한다.
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  return row && ok ? toPublic(row) : null;
}

export async function getUser(id: string): Promise<PublicUser | null> {
  const sql = getSql();
  const rows = await sql<UserRow[]>`select id, login_id, display_name, password_hash from users where id = ${id}`;
  return rows[0] ? toPublic(rows[0]) : null;
}

// 회원의 가게로 연결한다 (이미 연결돼 있으면 그대로). 가게는 먼저 저장돼 있어야 한다.
export async function linkPlace(userId: string, placeId: string): Promise<void> {
  const sql = getSql();
  await sql`insert into user_places (user_id, place_id) values (${userId}, ${placeId}) on conflict do nothing`;
}

export async function listPlaceIds(userId: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql<{ place_id: string }[]>`select place_id from user_places where user_id = ${userId} order by created_at`;
  return rows.map((r) => r.place_id);
}

// 형식만 맞는 가짜 해시. 어떤 비밀번호와도 일치하지 않는다.
const DUMMY_HASH = `scrypt$16384$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;
