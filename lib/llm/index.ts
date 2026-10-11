import { createAnthropicGenerate, DEFAULT_MODEL } from "./anthropic.ts";
import type { Generate } from "./chat.ts";
import { stubGenerate } from "./stub.ts";

export { runChat } from "./chat.ts";
export type { ChatEvent, EvidenceCard, Generate } from "./chat.ts";

// 환경변수로 쓸 LLM을 고른다. 서버에서만 호출한다. 키가 없으면 null (챗봇 준비 중으로 안내).
export function selectGenerate(env: NodeJS.ProcessEnv = process.env): Generate | null {
  if (env.LLM_PROVIDER === "stub") return stubGenerate;
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return createAnthropicGenerate(key, env.LLM_MODEL?.trim() || DEFAULT_MODEL);
}
