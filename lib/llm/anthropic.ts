import Anthropic from "@anthropic-ai/sdk";
import type { Generate } from "./chat.ts";

// Claude 호출은 이 파일 한 곳에서만 한다. 모델이나 업체를 바꿀 때 이 파일(과 index.ts)만 고치면 된다.
export const DEFAULT_MODEL = "claude-sonnet-5-5";

// 한글은 글자당 토큰이 많이 든다. 1024면 실행안 2~3개짜리 답변이 중간에 잘린다.
// 답변 길이는 프롬프트(약 700자)로 조절하고, 이 값은 안전한 상한으로만 둔다.
export const MAX_TOKENS = 2048;

export const TRUNCATED_NOTE = "\n\n(답변이 길어서 여기까지만 보여드렸어요. 이어서 궁금한 부분을 물어봐 주세요.)";

export function createAnthropicGenerate(apiKey: string, model: string = DEFAULT_MODEL): Generate {
  const client = new Anthropic({ apiKey });
  return async function* generate(prompt) {
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
    let stopReason: string | null | undefined;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      } else if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason;
      }
    }
    // 길이 제한에 걸려 끊긴 경우, 사장님이 "고장"으로 오해하지 않게 안내를 붙인다.
    if (stopReason === "max_tokens") yield TRUNCATED_NOTE;
  };
}
