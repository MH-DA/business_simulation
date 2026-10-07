// 2단계용 가짜 챗봇 답변. 5단계에서 /api/chat(RAG + LLM)으로 교체한다.
// 숫자는 data/places/sample-cafe*.json 으로 계산되는 값과 맞춰 두었다.
// 근거 카드의 knowledgeId 는 data/knowledge/principles.json 의 실제 ID다.

export type Strength = "강함" | "중간" | "혼재";

export type MockAnswer = {
  title: string;
  intro: string;
  subheading?: string;
  points: { title: string; body: string }[];
  followup?: { title: string; steps: string[]; body: string };
  evidence: { knowledgeId: string; title: string; summary: string; strength: Strength }[];
  confirm?: { text: string; buttons: string[] };
};

export const FAQ: { question: string; answerKey: keyof typeof ANSWERS }[] = [
  { question: "신규 고객을 유입하려면 어떻게 해야 하나요?", answerKey: "newCustomer" },
  { question: "재방문을 유도하려면 어떤 전략을 써야 하나요?", answerKey: "retention" },
  { question: "우리 가게의 강점을 어떻게 홍보하면 좋을까요?", answerKey: "strength" },
  { question: "리뷰의 불편 사항을 어떻게 개선하면 좋을까요?", answerKey: "complaint" },
];

export const ANSWERS = {
  retention: {
    title: "적립 혜택이 있어도, 다시 방문할 이유가 충분하지 않을 수 있어요.",
    intro:
      "쿠폰은 재방문을 돕는 수단이지만, 혜택을 받기까지의 부담과 방문 경험을 함께 살펴봐야 해요. 현재 쿠폰 조건과 고객별 방문 기록이 없어 원인을 확정할 수는 없어요.",
    subheading: "먼저 확인할 세 가지 가능성",
    points: [
      {
        title: "보상까지의 거리가 멀어요",
        body: "필요한 방문 횟수나 유효기간이 고객의 방문 주기와 맞지 않으면, 적립을 시작해도 다음 방문으로 이어지기 어려울 수 있어요.",
      },
      {
        title: "혜택의 매력이나 사용 방법이 잘 전달되지 않아요",
        body: "고객이 보상을 원하는지, 적립·사용 조건을 쉽게 이해하는지 확인해야 해요.",
      },
      {
        title: "방문 경험에서 불편을 느낄 수 있어요",
        body: "샘플 리뷰에 나타난 좌석 부족과 정보 안내 문제도 확인 대상이에요. 다만 리뷰만으로 재방문이 낮은 원인이라고 단정할 수는 없어요.",
      },
    ],
    followup: {
      title: "혜택을 늘리기 전에, 고객이 어디서 멈추는지 확인해보세요.",
      steps: [
        "쿠폰을 받은 고객 중 적립을 시작한 비율",
        "첫 적립 고객 중 정해진 기간 안에 다시 방문한 비율",
        "보상 조건을 채운 고객 중 실제로 사용한 비율",
      ],
      body: "첫 재방문 단계에서 많이 멈춘다면, 첫 재방문 보상을 더 일찍 제공하는 소규모 실험을 해볼 수 있어요. 같은 관찰 기간으로 기존 방식과 재방문율·보상 비용을 비교한 뒤 확대 여부를 정하시면 돼요.",
    },
    evidence: [
      {
        knowledgeId: "K-retention-01",
        title: "목표 가속·부여된 진행",
        summary: "목표에 가까울수록 더 열심히 하고, 이미 진행된 것처럼 느끼면 끝까지 채울 가능성이 높아져요.",
        strength: "강함",
      },
      {
        knowledgeId: "K-experience-01",
        title: "피크엔드 법칙",
        summary: "손님은 가장 좋았던 순간과 마지막 순간으로 방문을 기억해요.",
        strength: "강함",
      },
    ],
    confirm: {
      text: "지금 쿠폰은 몇 번 방문하면 어떤 혜택을 주나요? 유효기간도 알려주시면, 조건부터 함께 점검해드릴게요.",
      buttons: ["5회 이하", "6~9회", "10회 이상", "쿠폰이 없어요"],
    },
  },
  newCustomer: {
    title: "처음 오는 손님이 고를 근거를 늘리는 쪽부터 보시면 좋아요.",
    intro:
      "카페 온유의 방문자 리뷰는 180개로, 비교한 근처 카페(320개)보다 적어요. 처음 보는 가게를 고를 때 손님은 별점보다 리뷰 수와 다른 사람의 선택을 더 참고하는 경향이 있어요.",
    subheading: "살펴볼 수 있는 방법",
    points: [
      {
        title: "좋은 경험 직후에 리뷰를 부탁해요",
        body: "커피 맛(72%)과 차분한 분위기(62%)가 이미 많이 선택되고 있어요. 계산할 때나 자리를 정리할 때 짧게 리뷰를 안내하면 자연스러워요.",
      },
      {
        title: "소개글 첫 두 줄에 강점을 담아요",
        body: "플레이스에서는 대표 사진과 소개글 앞부분이 첫인상을 거의 결정해요. 핸드드립과 직접 구운 디저트를 앞에 두는 걸 고려해볼 수 있어요.",
      },
    ],
    evidence: [
      {
        knowledgeId: "K-trust-02",
        title: "리뷰 수 휴리스틱",
        summary: "별점이 비슷하면 손님은 리뷰가 많은 쪽을 더 믿는 경향이 있어요.",
        strength: "강함",
      },
      {
        knowledgeId: "K-experience-03",
        title: "처리 유창성",
        summary: "쉽게 이해되는 첫 정보가 더 신뢰를 얻어요.",
        strength: "강함",
      },
    ],
    confirm: {
      text: "지금 손님께 리뷰를 따로 안내하고 계신가요?",
      buttons: ["안내하고 있어요", "따로 안 해요", "잘 모르겠어요"],
    },
  },
  strength: {
    title: "손님들이 이미 고른 말로 강점을 보여주는 게 가장 자연스러워요.",
    intro:
      "리뷰에서 가장 많이 선택된 키워드는 '커피가 맛있어요'(72%), '분위기가 차분해요'(62%), '친절해요'(53%)예요. 근처 카페보다 높은 편이라 카페 온유의 분명한 특징으로 볼 수 있어요.",
    subheading: "홍보에 활용하는 방법",
    points: [
      {
        title: "강점을 구체적인 장면으로 바꿔요",
        body: "'맛있는 커피' 대신 '주문할 때마다 한 잔씩 내리는 핸드드립'처럼 손님이 떠올릴 수 있는 장면으로 쓰면 더 잘 전달돼요.",
      },
      {
        title: "사진도 같은 이야기를 하게 해요",
        body: "드립 과정이나 조용한 좌석 사진을 대표 사진 앞쪽에 두면 소개글과 사진이 같은 강점을 말하게 돼요.",
      },
    ],
    evidence: [
      {
        knowledgeId: "K-trust-01",
        title: "사회적 증거",
        summary: "확신이 없을 때 손님은 다른 사람들의 선택을 따라가요.",
        strength: "강함",
      },
    ],
  },
  complaint: {
    title: "불편 사항은 먼저 사실인지, 마케팅으로 풀 문제인지 나눠서 보면 좋아요.",
    intro:
      "'좌석이 넉넉해요'는 6%로 근처 카페 평균(30%)보다 24%p 낮고, '메뉴 설명이 자세해요'와 '주차하기 편해요'도 평균보다 낮아요. 다만 키워드가 낮다는 것만으로 불만이 많다고 단정할 수는 없어요.",
    subheading: "나눠서 볼 점",
    points: [
      {
        title: "좌석: 운영 확인이 필요해요",
        body: "실제 좌석 수가 적은 거라면 마케팅보다 운영 문제예요. 혼잡한 시간대를 소개글에 안내해 기대를 맞추는 방법은 있어요.",
      },
      {
        title: "메뉴·주차 안내: 정보로 풀 수 있어요",
        body: "원두 설명과 주차 위치를 플레이스 정보와 소식에 정리하면 비교적 빠르게 개선할 수 있어요.",
      },
    ],
    evidence: [
      {
        knowledgeId: "K-experience-02",
        title: "기대 불일치",
        summary: "만족은 경험 자체보다 기대와의 차이로 결정돼요.",
        strength: "강함",
      },
      {
        knowledgeId: "K-trust-04",
        title: "부정성 편향",
        summary: "나쁜 경험 하나가 좋은 경험 여러 개보다 크게 느껴져요.",
        strength: "강함",
      },
    ],
    confirm: {
      text: "주말 오후처럼 붐비는 시간에 자리가 부족한 편인가요?",
      buttons: ["자주 부족해요", "가끔 그래요", "거의 없어요"],
    },
  },
  fallback: {
    title: "질문을 잘 받았어요.",
    intro:
      "지금은 화면 확인용 샘플 답변이에요. 챗봇 연결 단계에서 가게 분석 결과와 마케팅 지식을 근거로 이 질문에 맞춘 답변을 드리게 돼요.",
    points: [],
    evidence: [],
  },
} satisfies Record<string, MockAnswer>;

export type AnswerKey = keyof typeof ANSWERS;
