// 공통 데이터 타입. 팀 전원이 이 형식에 먼저 합의하고, 각자 Mock으로 작업한 뒤 합친다.
// 변경할 때는 팀에 먼저 공유할 것. (WORKFLOW.md 5장 기준)

export const INDUSTRIES = ["음식점", "카페", "공방", "헬스장", "스터디카페"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export type Store = {
  placeId: string;
  name: string;
  category: string;
  address?: string;
  photoUrl?: string; // 가게 카드 사진 (Figma 02)
  rating?: number;
  visitorReviewCount?: number;
  blogReviewCount?: number;
  hasBookingTab?: boolean;
  tabs: string[]; // 플레이스 탭 목록 (예약 탭 유무 등)
  amenities: string[];
  intro?: string;
  representativeKeywords: string[];
  coupons: string[];
  hasCoupon?: boolean; // 쿠폰 유무 (수집기는 유무만 확인한다. 수집 전이면 비어 있음)
  hasNaverPay?: boolean; // 네이버페이 사용 여부 (수집 전이면 비어 있음)
  lastNewsDate?: string; // 가장 최근 새소식 날짜, ISO 8601 (수집 전이면 비어 있음)
  // ↓ Figma 분석 결과 화면(PLACEMENT)에서 쓰는 항목. 모두 선택: 수집 전이면 비어 있고 화면은 "확인 전"으로 보여준다.
  closedDays?: string; // 휴무일 문구 그대로 (예: "연중무휴", "매주 월요일 휴무")
  openHours?: string; // 영업시간 문구 그대로 (예: "09:30 ~ 22:00")
  ownerPhotoCount?: number; // 사장님이 올린 업체 사진 수
  hasPlacePlus?: boolean; // 플레이스 플러스 사용 흔적
  instagramUrl?: string; // 플레이스에 등록된 인스타그램 링크
  blogUrl?: string; // 플레이스에 등록된 블로그 링크
  keywordParticipants?: number; // "이런 점이 좋았어요" 참여 인원 (비율의 분모로 쓴다)
  industry: Industry;
  // 수집하지 못한 목록·글 항목. 빈 목록([])이나 빈 글은 "없음"과 구분이 안 되어 따로 적는다.
  // 여기 있는 항목은 화면과 챗봇에서 "없음"이 아니라 "확인 전"으로 다룬다. (lib/checked.ts)
  unchecked?: UncheckedField[];
};

export type UncheckedField = "intro" | "amenities" | "coupons" | "representativeKeywords" | "tabs" | "instagramUrl" | "blogUrl";

// ratio = count / keywordParticipants ("이런 점이 좋았어요" 참여 인원. 원 숫자 비교 금지, 항상 비율로 비교)
export type KeywordStat = { keyword: string; count: number; ratio: number };

// 리뷰 원문. 작성자 닉네임·프로필·사진 파일은 저장 금지 (개인정보).
export type Review = {
  visitedDate?: string;
  createdDate?: string;
  visitCount?: number;
  authType?: "영수증" | "예약" | "기타";
  votedKeywords: string[];
  photoCount?: number;
  hasOwnerReply?: boolean;
  ownerReply?: string;
  body: string;
  source: "crawler" | "octoparse" | "manual" | "mock";
};

// Provider가 돌려주는 한 번의 수집 결과 (= 스냅샷 한 장)
export type CollectedPlace = {
  store: Store;
  keywordStats: KeywordStat[];
  reviews: Review[];
  collectedAt: string; // ISO 8601
  source: "crawler" | "octoparse" | "manual" | "mock" | "demo";
};

// 점수·가중치·우선순위 필드 없음. 사실과 신호 유형만 담는다. (PROJECT.md 10·11장)
export type Finding = {
  id: string;
  type: "높음" | "낮음" | "정보";
  keyword?: string;
  mine?: number;
  competitorAvg?: number;
  gapPp?: number;
  category: "마케팅" | "비마케팅";
  signalType: string; // PROJECT.md 11장 신호 유형 목록의 값
  needsOwnerCheck: boolean;
};

export type Card =
  | { id: string; kind: "발견"; text: string; findingId: string }
  | { id: string; kind: "근거"; knowledgeId: string; title: string; summary: string; strength: "강함" | "중간" | "혼재" }
  | { id: string; kind: "확인"; text: string; buttons: string[] };

// data/knowledge/principles.json 의 한 항목 (원본: docs/knowledge/*.html)
export type KnowledgeChunk = {
  id: string;
  layer: "노출" | "선택";
  principle: string;
  principleEn?: string;
  category: string;
  strength: "강함" | "중간" | "혼재";
  core: string[];
  apply: string[];
  examples: Partial<Record<Industry, string>>;
  signals: string[];
  actions: string[];
  description?: string;
  placeApplication?: string;
  caution?: string;
  source?: string;
  sourceFile?: string;
  signalTypes: string[];
};

// data/knowledge/guardrails.json 의 한 항목. 모든 LLM 호출에 항상 포함
export type Guardrail = { id: string; rule: string; detail: string };

// 분석 작업(job) 상태. /api/analyze → /api/jobs/[jobId]
export type JobStatus = "queued" | "collecting" | "analyzing" | "done" | "failed" | "needs_collection";

export type Job = {
  jobId: string;
  placeId: string;
  status: JobStatus;
  error?: string;
  createdAt: string;
};

// 시점별 비교용 저장 단위. CollectedPlace를 그대로 저장한 것
export type Snapshot = CollectedPlace & { snapshotId: string };

// 확인 필요 카드에 대한 사장님 답변 (/api/answers)
export type OwnerAnswer = {
  placeId: string;
  cardId: string;
  question: string;
  answer: string;
  answeredAt: string; // ISO 8601
};
