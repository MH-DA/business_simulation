// 공통 데이터 타입. 팀 전원이 이 형식에 먼저 합의하고, 각자 Mock으로 작업한 뒤 합친다.
// 변경할 때는 팀에 먼저 공유할 것. (WORKFLOW.md 5장 기준)

export const INDUSTRIES = ["음식점", "카페", "공방", "헬스장", "스터디카페"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export type Store = {
  placeId: string;
  name: string;
  category: string;
  address?: string;
  rating?: number;
  visitorReviewCount?: number;
  blogReviewCount?: number;
  hasBookingTab?: boolean;
  amenities: string[];
  intro?: string;
  representativeKeywords: string[];
  industry: Industry;
};

// ratio = count / visitorReviewCount (원 숫자 비교 금지, 항상 비율로 비교)
export type KeywordStat = { keyword: string; count: number; ratio: number };

// 리뷰 원문. 작성자 닉네임·프로필·사진 파일은 저장 금지 (개인정보).
export type Review = {
  visitedDate?: string;
  createdDate?: string;
  visitCount?: number;
  authType?: "영수증" | "예약";
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

export type Finding = {
  type: "강점" | "약점" | "정보";
  keyword?: string;
  mine?: number;
  competitorAvg?: number;
  gapPp?: number;
  category: "마케팅" | "비마케팅";
  problemType: string;
  needsOwnerCheck: boolean;
};

export type Card =
  | { kind: "발견"; text: string; findingId: string }
  | { kind: "근거"; knowledgeId: string; title: string; strength: "강함" | "중간" | "혼재" }
  | { kind: "확인"; text: string; buttons: string[] };

export type KnowledgeChunk = {
  id: string;
  principle: string;
  category: string;
  strength: "강함" | "중간" | "혼재";
  core: string[];
  apply: string[];
  examples: Partial<Record<Industry, string>>;
  signals: string[];
  caution?: string;
  source?: string;
  problemTypes: string[];
};

// 분석 작업(job) 상태. /api/analyze → /api/jobs/[jobId]
export type JobStatus = "queued" | "collecting" | "diagnosing" | "done" | "failed";

export type Job = {
  jobId: string;
  placeId: string;
  status: JobStatus;
  error?: string;
  createdAt: string;
};
