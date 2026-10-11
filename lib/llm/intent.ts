// 질문 분류. 지금은 규칙(키워드)으로 나눈다. 자유 질문이 많아져 빗나가면 LLM 분류 호출로 바꾼다. (PROJECT.md 5장)
export type Intent = "new_customer" | "retention" | "strength_promotion" | "complaint_improve";
export type QuestionType = "진단 설명" | "실행안 생성" | "판단 보조";

const INTENT_RULES: [Intent, RegExp][] = [
  ["new_customer", /신규|새 손님|새로운 손님|유입|처음 오는|첫 방문/],
  ["retention", /재방문|단골|다시 오|재구매|리텐션/],
  ["strength_promotion", /강점|홍보|알리|자랑/],
  ["complaint_improve", /불편|불만|개선|부정|나쁜 리뷰|컴플레인/],
];

const JUDGE = /\S도 (될까|괜찮|되나|되겠|될지)|괜찮을까|해볼까|하는 게 (좋을까|맞을까)|해야 할까/;
const WHY = /왜|이유|원인/;

export type Classified = { intent: Intent | null; type: QuestionType };

export function classifyQuestion(question: string): Classified {
  const intent = INTENT_RULES.find(([, re]) => re.test(question))?.[0] ?? null;
  // 판단을 구하는 질문이 먼저다. 결론을 대신 내리지 않고 확인 질문으로 끝낸다.
  if (JUDGE.test(question)) return { intent, type: "판단 보조" };
  if (WHY.test(question)) return { intent, type: "진단 설명" };
  if (/어떻게|방법|전략|문구|하면 좋|해야/.test(question)) return { intent, type: "실행안 생성" };
  return { intent, type: "진단 설명" };
}

// 질문에 나온 주제어 → 그 주제에 붙은 신호 이름. 우리 가게 값이 좋은지 나쁜지와 상관없이, 질문이 그 항목을 묻는다는 뜻이다.
const TOPIC_RULES: [RegExp, string[]][] = [
  [/쿠폰|적립|스탬프|혜택|할인/, ["coupon_missing", "coupon_exists_retention_low", "promotion_timing"]],
  [/답글|댓글/, ["negative_review_no_reply"]],
  [/리뷰|별점|후기/, ["review_count_low", "review_request", "rating_high_reviews_low"]],
  [/소개글|소개/, ["intro_weak", "intro_no_evidence", "expectation_gap"]],
  [/소식|이벤트|공지/, ["news_inactive", "promotion_timing"]],
  [/사진/, ["photo_weak"]],
  [/환불|해지|취소/, ["refund_info_missing"]],
  [/가격|요금|메뉴/, ["price_keyword_low", "price_options_few", "menu_items_many"]],
];

export function topicSignals(question: string): string[] {
  return [...new Set(TOPIC_RULES.filter(([re]) => re.test(question)).flatMap(([, s]) => s))];
}
