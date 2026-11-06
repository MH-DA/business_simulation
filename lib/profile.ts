// Figma 05 · 성향 파악 1~5 의 질문과 선택지. 화면과 서버(프롬프트)가 같은 목록을 쓴다.
// 서버는 화면에서 받은 "번호"만 이 목록으로 바꿔 넣는다. 화면이 보낸 글을 프롬프트에 그대로 넣지 않는다.

export const PROFILE_STEPS = [
  {
    key: "goal",
    label: "목표",
    question: "지금, 우리 가게에 가장 필요한 변화는 무엇인가요?",
    options: [
      "새로운 손님을 더 만나고 싶어요.",
      "찾아온 손님이 다시 방문하면 좋겠어요.",
      "검색할 때 우리 가게가 잘 보이면 좋겠어요.",
      "예약과 문의를 늘리고 싶어요.",
      "어디서부터 시작할지 함께 찾고 싶어요.",
    ],
  },
  {
    key: "experience",
    label: "경험",
    question: "마케팅, 지금의 나는 어디쯤인가요?",
    options: [
      "처음이라 차근차근 배우고 싶어요.",
      "몇 번 시도했지만 아직 막막해요.",
      "방법은 알지만 꾸준히 실행하기 어려워요.",
      "꾸준히 하고 있지만 더 잘하고 싶어요.",
      "성과를 살펴보며 개선하고 있어요.",
    ],
  },
  {
    key: "budget",
    label: "예산",
    question: "마케팅에 한 달에 얼마까지 사용할 수 있나요?",
    options: ["우선 비용 없이 시작하고 싶어요.", "0원 초과 ~ 5만 원 미만", "5만 원 이상 ~ 10만 원 미만", "10만 원 이상 ~ 30만 원 미만", "30만 원 이상"],
  },
  {
    key: "time",
    label: "시간",
    question: "마케팅에 일주일에 얼마나 시간을 낼 수 있나요?",
    options: ["주 30분 미만", "주 30분 이상 ~ 1시간 미만", "주 1시간 이상 ~ 3시간 미만", "주 3시간 이상 ~ 5시간 미만", "주 5시간 이상"],
  },
  {
    key: "difficulty",
    label: "어려움",
    question: "마케팅을 하려 할 때, 무엇이 가장 어렵나요?",
    options: [
      "무엇부터 해야 할지 모르겠어요.",
      "가게 일로 바빠 시간을 내기 어려워요.",
      "글쓰기나 사진·영상 만들기가 어려워요.",
      "비용이 부담되고 효과가 있을지 걱정돼요.",
      "특별한 어려움은 없어요.",
    ],
  },
] as const;

export type ProfileAnswers = (number | null)[]; // PROFILE_STEPS 순서대로 고른 번호

export type Stage = { name: string; desc: string };

// 경험 답이 앞의 두 개면 시작 단계, 나머지는 개선 단계 (사장님이 고른 답을 그대로 따른다. 점수 판정 아님)
export function stageOf(answers: ProfileAnswers): Stage | null {
  const exp = answers[1];
  if (exp == null) return null;
  return exp <= 1
    ? { name: "마케팅 시작 단계", desc: "기본부터 차근차근 안내해드려요" }
    : { name: "마케팅 개선 단계", desc: "지금 하는 마케팅을 더 잘하도록 도와드려요" };
}

// 서버용: 번호 배열을 검증해 프롬프트 줄로 바꾼다. 범위를 벗어난 값은 버린다.
export function profileLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const lines: string[] = [];
  PROFILE_STEPS.forEach((step, i) => {
    const v = raw[i];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < step.options.length) {
      lines.push(`${step.label}: ${step.options[v]}`);
    }
  });
  const stage = stageOf(raw.map((v) => (typeof v === "number" ? v : null)));
  if (stage && lines.some((l) => l.startsWith("경험"))) lines.push(`상담 방향: ${stage.name} (${stage.desc})`);
  return lines;
}
