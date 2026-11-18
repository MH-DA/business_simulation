import { MAX_TOKENS, TRUNCATED_NOTE } from "./anthropic.ts";
import type { Generate } from "./chat.ts";

// OpenAI 호출은 이 파일 한 곳에서만 한다. (LLM_PROVIDER=openai 일 때 index.ts 가 고른다)
// 라이브러리를 새로 설치하지 않도록 공식 REST API(Chat Completions, 스트리밍)를 fetch 로 직접 부른다.
export const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const URL = "https://api.openai.com/v1/chat/completions";

export function createOpenAIGenerate(apiKey: string, model: string = DEFAULT_OPENAI_MODEL): Generate {
  return async function* generate(prompt) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        max_completion_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    });
    if (!res.ok || !res.body) {
      // 키 오류·모델 이름 오류 등. 응답 본문에 키가 들어 있지 않으니 원인 파악용으로 앞부분만 남긴다.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`OpenAI 호출 실패 (${res.status}): ${detail}`);
    }

    // 스트리밍 응답은 "data: {...}" 줄이 이어서 온다. 줄이 조각나서 올 수 있어 버퍼에 모아 한 줄씩 처리한다.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finishReason: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.trim();
        if (!data.startsWith("data:")) continue;
        const payload = data.slice(5).trim();
        if (payload === "[DONE]") continue;
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
        };
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) yield choice.delta.content;
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      }
    }
    // 길이 제한에 걸려 끊긴 경우, 사장님이 "고장"으로 오해하지 않게 안내를 붙인다.
    if (finishReason === "length") yield TRUNCATED_NOTE;
  };
}
