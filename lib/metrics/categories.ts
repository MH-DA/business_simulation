import type { Finding } from "@/types";

// 업종별 키워드 분류표(PROJECT.md 10장). 분류만 하고 점수는 없다.
export const KEYWORD_GROUPS = ["맛·품질", "가격", "응대", "청결·시설", "공간·분위기", "편의", "기타"] as const;
export type KeywordGroup = (typeof KEYWORD_GROUPS)[number];

// 키워드 문장에 들어 있는 단어로 분류한다. 위에서부터 먼저 맞는 그룹을 쓴다.
const RULES: [KeywordGroup, string[]][] = [
  ["가격", ["가격", "가성비", "저렴", "합리"]],
  ["응대", ["친절", "응대", "설명", "상담", "꼼꼼", "자세", "권유"]],
  ["청결·시설", ["깔끔", "깨끗", "청결", "시설", "샤워", "위생"]],
  ["공간·분위기", ["분위기", "인테리어", "넓", "아늑", "조용", "뷰"]],
  ["편의", ["주차", "접근", "예약", "대기", "교통", "편해요", "편리"]],
  ["맛·품질", ["맛", "품질", "신선", "양이", "다양", "운동기구", "장비", "퀄리티"]],
];

export function classifyKeyword(keyword: string): KeywordGroup {
  for (const [group, words] of RULES) if (words.some((w) => keyword.includes(w))) return group;
  return "기타";
}

// 가정: 안내·표현·구성으로 바꿀 수 있는 그룹은 "마케팅", 운영 자체(품질·응대·시설)는 "비마케팅".
// 팀 합의가 필요한 값이라 이 표 한 곳에서만 바꾼다.
const MARKETING_GROUPS: KeywordGroup[] = ["가격", "공간·분위기", "편의"];

export function categoryOf(group: KeywordGroup): Finding["category"] {
  return MARKETING_GROUPS.includes(group) ? "마케팅" : "비마케팅";
}
