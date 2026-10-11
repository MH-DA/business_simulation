import Anthropic from "@anthropic-ai/sdk";
import type { Generate } from "./chat.ts";

// Claude 호출은 이 파일 한 곳에서만 한다. 모델이나 업체를 바꿀 때 이 파일(과 index.ts)만 고치면 된다.
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function createAnthropicGenerate(apiKey: string, model: string = DEFAULT_MODEL): Generate {
  const client = new Anthropic({ apiKey });
  return async function* generate(prompt) {
    const stream = client.messages.stream({
      model,
      max_tokens: 1024,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  };
}
