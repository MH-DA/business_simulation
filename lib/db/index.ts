import postgres from "postgres";

// DB 연결은 이 파일 한 곳에서만 만든다. 접속 주소는 .env.local 의 DATABASE_URL (서버에서만 읽는다).
// Supabase 대시보드 → Connect → Session pooler 주소를 쓴다. (Direct 연결은 IPv6 전용이라 Vercel에서 막힐 수 있다)
export type Sql = ReturnType<typeof postgres>;

// 개발 서버가 코드를 다시 불러와도 연결이 계속 늘어나지 않게 전역에 하나만 둔다.
const g = globalThis as unknown as { __sql?: Sql };

export function getSql(): Sql {
  if (g.__sql) return g.__sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 이 없어요. .env.local 에 Supabase 접속 주소(Session pooler)를 넣어 주세요.");
  }
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  g.__sql = postgres(url, {
    prepare: false, // pooler(transaction 모드)는 prepared statement를 지원하지 않는다
    ssl: local ? false : "require",
    max: 3, // 무료 플랜의 연결 수가 작아서 적게 쓴다
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return g.__sql;
}

// 스크립트가 끝날 때 연결을 닫는다. (웹 서버에서는 부르지 않는다)
export async function closeSql(): Promise<void> {
  if (!g.__sql) return;
  const sql = g.__sql;
  g.__sql = undefined;
  await sql.end({ timeout: 5 });
}
