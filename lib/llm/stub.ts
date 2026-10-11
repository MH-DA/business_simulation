import type { Generate } from "./chat.ts";

// 개발용 가짜 LLM (LLM_PROVIDER=stub). API 키 없이 화면 흐름과 근거 카드를 확인할 때만 쓴다.
// 프롬프트에 들어 있는 지식 ID를 그대로 "사용했다"고 돌려주므로, 실제 답변 품질과는 무관하다.
export const stubGenerate: Generate = async function* (prompt) {
  const ids = [...prompt.user.matchAll(/^\[(K-[A-Za-z]+-\d+)\]/gm)].map((m) => m[1]).slice(0, 2);
  const judge = prompt.system.includes("[이번 질문 유형: 판단 보조]");
  const parts = [
    "(개발용 가짜 답변이에요) ",
    "질문을 받았고, 비교 사실과 지식 조각을 함께 확인했어요. ",
    "실제 답변은 LLM 키를 연결하면 이 자리에 나와요.",
  ];
  for (const p of parts) yield p;
  if (ids.length) yield `\n[[근거: ${ids.join(", ")}]]`;
  if (judge) yield "\n[[확인: 최근 이 방법을 써본 적이 있나요? | 네 | 아니요 | 잘 모르겠어요]]";
};
