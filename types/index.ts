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
  industry: Industry;
};

// ratio = count / visitorReviewCount (원 숫자 비교 금지, 항상 비율로 비교)
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
export type JobStatus = "queued" | "collecting" | "analyzing" | "done" | "failed";

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
