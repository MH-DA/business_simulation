// DB 없이 개발할 때 쓰는 임시 보관소. DATABASE_URL 이 없고 배포 환경이 아닐 때만 쓴다.
// 서버를 다시 켜면 회원과 대화 기록이 모두 사라진다. (팀원이 DB 없이 화면을 확인하는 용도)
export function isMemoryMode(): boolean {
  if (process.env.DATABASE_URL) return false;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL 이 없어요. 배포 환경에서는 회원·대화 기록을 DB에 저장해야 해요.");
  }
  return true;
}

type MemoryUser = { id: string; login_id: string; display_name: string; password_hash: string };
export type MemoryConversation = {
  id: string;
  user_id: string;
  place_id: string;
  competitor_id: string | null;
  title: string;
  created_at: Date;
  updated_at: Date;
};
export type MemoryMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  evidence: unknown[];
  confirm: unknown;
  created_at: Date;
};

type Memory = { users: MemoryUser[]; conversations: MemoryConversation[]; messages: MemoryMessage[] };

const g = globalThis as unknown as { __placementMemory?: Memory };
export const memory: Memory = (g.__placementMemory ??= { users: [], conversations: [], messages: [] });
