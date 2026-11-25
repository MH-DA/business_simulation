// 스마트플레이스 설정 가이드 (Figma "04·05·07·08·09 · 네이버 플레이스 … 가이드", docs/design/guide-*.png)
// 사장님이 스마트플레이스에서 직접 따라 하는 2단계 안내. 화면은 app/guide/[topic]/page.tsx 하나가 모두 그린다.
// 단계 캡처 이미지(public/guide/<slug>-1.png, -2.png)는 시안 PNG에서 잘라 낸 것. 업체 식별 정보는 시안에서 이미 가렸다.

export type GuideStep = { title: string; body: string; image: string; alt: string };
export type SmartplaceGuide = {
  slug: string;
  title: string;
  subtitle: string;
  steps: [GuideStep, GuideStep];
  finish: string; // 단계 아래 초록 글씨 마무리 안내
};

const img = (slug: string, n: 1 | 2) => `/guide/${slug}-${n}.png`;

export const SMARTPLACE_GUIDES: SmartplaceGuide[] = [
  {
    slug: "photo",
    title: "사진 등록, 이렇게 하면 쉬워요",
    subtitle: "스마트플레이스에서 두 단계만 따라 하면 사진을 추가할 수 있어요.",
    steps: [
      { title: "정보 수정 누르기", body: "스마트플레이스 메인 화면에서 [정보 수정]을 눌러주세요.", image: img("photo", 1), alt: "스마트플레이스 메인 화면의 정보 수정 버튼" },
      { title: "사진추가 누르기", body: "기본정보의 업체 사진에서 [사진추가]를 눌러주세요.", image: img("photo", 2), alt: "기본정보 화면의 업체 사진 추가 버튼" },
    ],
    finish: "등록할 사진을 선택하고 변경 사항을 저장해 주세요.",
  },
  {
    slug: "reservation",
    title: "예약 설정, 이렇게 하면 쉬워요",
    subtitle: "스마트플레이스에서 예약 기능을 설정하는 방법을 알려드려요.",
    steps: [
      { title: "예약 탭 누르기", body: "스마트플레이스 왼쪽 메뉴에서 [예약]을 눌러주세요.", image: img("reservation", 1), alt: "스마트플레이스 왼쪽 메뉴의 예약 항목" },
      { title: "예약 서비스 설정하기", body: "예약 관리 화면에서 우리 가게에 맞는 예약 서비스를 설정해 주세요.", image: img("reservation", 2), alt: "예약 관리 화면의 예약 서비스 설정 항목" },
    ],
    finish: "예약 설정을 확인하고 변경 사항을 저장해 주세요.",
  },
  {
    slug: "coupon",
    title: "쿠폰 생성, 이렇게 하면 쉬워요",
    subtitle: "스마트플레이스에서 우리 가게의 쿠폰을 만드는 방법을 알려드려요.",
    steps: [
      { title: "마케팅 메뉴에서 쿠폰 선택하기", body: "왼쪽 메뉴에서 [마케팅] → [쿠폰]을 눌러주세요.", image: img("coupon", 1), alt: "마케팅 메뉴의 쿠폰 화면과 신규 쿠폰 만들기 버튼" },
      { title: "신규 쿠폰 만들기", body: "[할인 쿠폰] or [증정 쿠폰] 중에 골라서 발급해주세요.", image: img("coupon", 2), alt: "신규 쿠폰 만들기 화면의 할인·증정 쿠폰 선택" },
    ],
    finish: "쿠폰 혜택, 제공 대상, 사용 조건과 기간을 설정해 주세요.",
  },
  {
    slug: "hours",
    title: "휴무일·영업시간, 이렇게 설정하세요",
    subtitle: "스마트플레이스에서 우리 가게의 영업시간과 휴무일을 설정하는 방법을 알려드려요.",
    steps: [
      { title: "정보 수정 누르기", body: "스마트플레이스 메인 화면에서 [정보 수정]을 눌러주세요.", image: img("hours", 1), alt: "업체정보 화면의 휴무일·영업시간 탭" },
      { title: "영업시간 및 휴무일 설정하기", body: "영업시간 항목에서 요일별 운영시간과 휴무일을 설정해 주세요.", image: img("hours", 2), alt: "휴무일과 영업시간 설정 화면" },
    ],
    finish: "설정한 영업시간과 휴무일을 확인한 뒤 저장해 주세요.",
  },
  {
    slug: "intro",
    title: "소개글 수정, 이렇게 하면 쉬워요",
    subtitle: "스마트플레이스에서 우리 가게의 소개글을 수정하는 방법을 알려드려요.",
    steps: [
      { title: "정보 수정 누르기", body: "스마트플레이스 메인 화면에서 [정보 수정]을 눌러주세요.", image: img("intro", 1), alt: "스마트플레이스 메인 화면의 정보 수정 버튼" },
      { title: "상세설명 수정하기", body: "기본정보의 [상세설명] 항목에서 소개글을 수정해 주세요.", image: img("intro", 2), alt: "기본정보 화면의 상세설명 입력란" },
    ],
    finish: "수정한 소개글을 확인한 뒤 저장해 주세요.",
  },
];

export function getGuide(slug: string): SmartplaceGuide | undefined {
  return SMARTPLACE_GUIDES.find((g) => g.slug === slug);
}

// 분석 결과 "플레이스 활용 현황" 카드 이름 → 가이드 (해당 기능이 꺼져 있거나 확인 전일 때 링크를 보여준다)
export const GUIDE_BY_STATUS_LABEL: Record<string, string> = {
  "업체 등록 사진": "photo",
  "예약 탭": "reservation",
  쿠폰: "coupon",
};
