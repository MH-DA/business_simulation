# 프로젝트 기획서: 사장님 AI 마케팅 도우미 (네이버 플레이스 기반 가게 진단 AI)

> 이 문서는 바이브 코딩 도구(Claude Code, Codex, Cursor, v0 등)에 그대로 전달하는 개발 기준서다.
> 모든 요청은 "PROJECT.md 기준으로"를 붙이고, 한 번에 한 단계(12번)씩만 요청한다.

## 0. 개요
- 수업: BA AI 경영 시뮬레이션 팀 프로젝트
- 한 줄 정의: 사장님이 네이버 플레이스 링크를 입력하면, 공개 데이터를 근거로 가게 상태를 진단하고
  챗봇 상담으로 지금 필요한 마케팅 실행 방법을 함께 찾아주는 웹 서비스
- 대상 업종: 음식점, 카페, 공방·원데이클래스, 헬스장, 스터디카페
- 핵심 타겟: 사장님이 직접 또는 소수 인원으로 운영하는 개인 매장, 마케팅 담당자·대행사 없음,
  신규 손님 대부분이 네이버 검색·지도로 유입 (기준 예: 방문자 리뷰 50~1,000개, 프랜차이즈 직영 제외)
- 핵심 원칙
  1. 점수화하지 않는다. 플레이스·마케팅 구조상 점수는 객관적이지 않으므로, 종합 점수·가중치·순위 없이 사실(수치)만 보여준다.
  2. 숫자는 코드(지표 계산 모듈)가 계산한 것만 쓴다. LLM은 숫자를 만들지 않고, 지식베이스를 근거로 설명·문구화만 한다.
  3. 무엇을 먼저 할지는 서비스가 정하지 않고, 근거를 보여준 뒤 사장님이 판단하도록 돕는다.
  4. 데이터로 알 수 없는 것은 사장님께 되묻는다 (확인 필요 카드).
  5. 처음부터 크롤러를 붙이지 않는다. Mock 데이터로 화면과 챗봇을 먼저 완성하고, 실제 수집기는 마지막에 연결한다.

## 1. 기능 범위
### 필수 (MVP)
1. 현황 진단: URL → 데이터 확보 → 선택 키워드·리뷰 기반 강점/불편 사항 추출
2. 마케팅 vs 비마케팅 문제 분류
   - 마케팅 문제: 노출·인지도·메시지 (리뷰 수 격차, 정보 완성도, 소식 활성도, 소개글 품질)
   - 비마케팅 문제: 상품·가격·운영·청결·응대 (해당 키워드 비율 저하)
   - 비마케팅 문제에는 마케팅 조언 대신 "운영 점검 필요"로 안내
3. 리뷰 분석 문단: 계산된 지표를 LLM이 사장님 말투의 짧은 문단으로 정리
4. 챗봇 상담: 사장님 질문에 계산된 지표 + 지식베이스(RAG)를 근거로 답변
5. 실행안 생성: 리뷰 요청 문구, 리뷰 답글 초안, 소개글 수정안
### 중요 (여유 시)
6. 시계열 자기 비교 (수집 시점별 스냅샷 "이전 vs 지금")
7. 지정 경쟁사 비교 (사용자가 경쟁 매장 URL 직접 입력)
8. 동종업계 벤치마크 (누적 매장 평균)
9. 액션 아이템 트래킹 (조언 실행 여부 체크인)

## 2. 기술 스택
| 영역 | 사용 기술 |
|---|---|
| 화면 + 서버 | Next.js (App Router) + TypeScript |
| 스타일 | Tailwind CSS + shadcn/ui, 글꼴 Pretendard |
| LLM | Claude 또는 OpenAI API (서버에서만 호출, `lib/llm/`에 모아 교체 가능하게) |
| 저장 | 초기 JSON 파일 → 이후 Supabase (PostgreSQL, 필요 시 pgvector) |
| RAG | 초기 문제 유형 태그 매칭 → 자유 질문 대응이 부족하면 벡터 검색 추가 |
| 수집기 | 기존 Python 수집기(Playwright) → 이후 FastAPI로 감싸 별도 서버 |
| 배포 | Vercel (웹), Render 또는 Railway (수집기) |

## 3. 화면 (Figma 기준)
| 화면 | 주소 | 구성 |
|---|---|---|
| 01 시작 페이지 | `/` | "우리 가게 상담 시작하기" 배지, "안녕하세요, 사장님!", 안내 문구, 네이버 플레이스 URL 입력창, [우리 가게 분석하기] 버튼, 하단 "플레이스 링크 찾는 방법" 링크 |
| 플레이스 링크 찾는 방법 | `/guide` | 링크 복사 방법 1~3단계 안내 박스, "같은 이름의 가게가 있다면 주소 확인" 문구, [우리 가게 분석하러 가기] 버튼 |
| 분석 중 *(디자인 추가 예정)* | `/analyzing/[jobId]` | 진행 단계 표시 (가게 정보 수집 → 키워드 분석 → 개선 포인트 찾기), 대기 중 지식 카드 1장 |
| 02 분석 결과 + 03·04 챗봇 | `/result/[placeId]` | 한 페이지에서 스크롤로 이어짐 (아래 참고) |

### `/result/[placeId]` 페이지 구성
- 상단: "우리 가게 분석이 끝났어요" + 부제
- 가게 카드: 가게 사진(플레이스 등록 사진 영역), 가게명 · 업종, 주소, 별점, "현재 확인된 키워드" 칩
- 두 칸 카드: [자주 언급되는 강점] / [자주 언급되는 불편 사항] (각 3줄)
- 리뷰 분석 카드: 소제목 "리뷰에서 읽히는 우리 가게의 경험" + 분석 문단 + 하단 작은 안내 문구(분석 기준)
- [아래로 내려 상담 시작하기 ↓] 버튼 → 챗봇 영역으로 스크롤
- 스크롤 시 가게 카드가 한 줄 요약(사진 썸네일, 가게명, 키워드 칩, 별점)으로 축소되어 상단 고정
- 챗봇 영역: "이제, 사장님의 고민을 들려주세요" + 부제, 자주 묻는 질문 4개(2×2 버튼), 입력창 + [보내기]
- 대화: 오른쪽 사장님 말풍선, 왼쪽 AI 답변 카드(번호 매긴 소제목 구조), 답변 옆 근거 카드, 필요 시 확인 필요 카드

### 화면 영역 ↔ 데이터 출처
| 영역 | 출처 |
|---|---|
| 가게 카드 | `Store` |
| 현재 확인된 키워드 칩 | `Store.representativeKeywords` (없으면 선택 키워드 상위 4개) |
| 자주 언급되는 강점 | 선택 키워드 비율이 높은 순 3개 (`Finding(type=높음)`) |
| 자주 언급되는 불편 사항 | 경쟁 매장 평균보다 비율이 낮은 키워드 + 리뷰 원문의 부정 표현 (`Finding(type=낮음)`) |
| 리뷰 분석 문단 | 계산된 지표 → LLM 문장화 |
| 자주 묻는 질문 4개 | 신규 고객 유입 / 재방문 유도 / 강점 홍보 / 불편 사항 개선 |

### 디자인 토큰 (Figma 스크린샷 기준)
- 메인 색: 진초록 (버튼, 강조) / 배경: 아주 연한 회녹색 / 안내 박스·칩: 연한 민트
- 카드: 흰색, 얇은 테두리, 큰 둥근 모서리 / 버튼: 진초록 채움, 흰 글씨, 둥근 모서리
- 헤더: 왼쪽 "서비스명", 오른쪽 "가게를 이해하는 AI 마케팅 파트너" (결과 페이지는 "가게 분석 / 맞춤 상담" 경로 표시)

## 4. 카드 UX (서비스 차별점)
| 카드 | 담는 것 | 출처 | 스타일 |
|---|---|---|---|
| 발견 카드 | 우리 가게의 사실과 숫자 | 지표 계산 모듈 | 차분한 회색·네이비, 단정형, 버튼 없음 |
| 근거 카드 | 그 사실이 왜 중요한지 (마케팅 원리) | 지식베이스 | 답변 옆 작은 카드, 원리 이름 + 한 줄 설명 + 근거 강도 배지 |
| 확인 필요 카드 | 데이터로 알 수 없어 사장님께 묻는 것 | 사장님 답변 저장 | 주황 계열, 질문형, 선택 버튼 |

- 예) 발견: "'가성비가 좋아요' 선택 비율이 24%로, 근처 카페 평균(48%)보다 24%p 낮아요"
- 예) 근거: "가격-품질 추론 · 근거 중간 · 정보가 부족하면 손님은 가격으로 품질을 추정해요"
- 예) 확인: "최근 메뉴 가격을 올리셨나요?" [네, 올렸어요] [아니요] [잘 모르겠어요]
- 흐름: 발견 → 근거 → 확인 질문 → 사장님 답변 저장 → 다음 진단·답변에 반영 (누적)
- 답변 문장과 근거 카드는 번호로 연결, 문장을 누르면 해당 근거 카드 강조

## 5. 챗봇 답변 방식 (RAG 활용)
| 질문 유형 | 답변 방식 | 처리 |
|---|---|---|
| "왜 이런 거예요?" | 진단 설명형 | 관련 지표 → 관련 원리 → 해석 (우선순위는 단정하지 않음) |
| "어떻게 해요?" | 실행안 생성형 | 강점 키워드 + 원리 + 가드레일 → 바로 쓸 문구 2~3개 |
| "이렇게 해도 될까요?" | 판단 보조형 | 근거 정리 후 결론 대신 확인 필요 카드로 끝냄 |

- 처리 순서: 질문 → LLM이 의도 분류 → 의도별로 가져올 지표·지식 검색 조건(신호 유형, 업종, 가드레일) 결정 → LLM 답변
- LLM은 답변과 함께 사용한 지식 ID 목록을 출력 → 서버가 실제 검색 결과에 있는 ID만 근거 카드로 표시
- 지식 강도 '중간'은 "가능성이 높아요"처럼 표현 수위를 낮추고, '혼재'는 단정하지 않음

## 6. 데이터 확보 현황 (실제 수집 테스트 결과)
| 항목 | 상태 | 비고 |
|---|---|---|
| 업체명, 업종, 별점, 방문자 리뷰 수 | 확보 | 업종 오등록 사례 있음 (스터디카페 → 장소대여) |
| 탭 목록, 예약 탭 유무 | 확보 | 업종마다 탭 구성 다름 |
| 선택 키워드 통계 (키워드 + 선택 인원) | 확보 | 핵심 데이터, 매장당 13~25개 |
| 편의시설 및 서비스, 소개글 | 확보 | 소개글에 "펼쳐보기" 등 화면 문구 섞임 → 정제 필요 |
| 대표 키워드 | 추출 가능 | 정보 탭 소개글 뒤에 노출 |
| 쿠폰 | 미확인 | |
| 플레이스 플러스 | 음식점만 해당 | POS 연동 서비스 |
| 블로그 리뷰 수, 업체 사진 수 | 미확보 | 추출 패턴 수정 필요 |
| 리뷰 원문 | 제한적 | 첫 페이지(약 10개)만 공개 데이터 가능성, 추가 로딩은 봇 확인으로 차단 |

- 리뷰 원문 보완: 수작업 샘플 입력, Octoparse 클라우드 수집(연구용 시연 데이터), 사장님 업로드
- 실서비스 가정: 사장님 계정 연동·동의 기반 데이터 수신
- 업종별 중요 데이터: 음식점(메뉴 수·가격, 맛·양·웨이팅 키워드) / 카페(사진, 분위기·좌석 키워드) / 공방(예약 상품, 소개글, 리뷰 수 신뢰)

## 7. 아키텍처와 데이터 흐름
```
[01 URL 입력] POST /api/analyze { url, industry }
  → [작업 생성] place_id 추출, 저장된 결과 있으면 즉시 완료 / 없으면 job 발급
  → [분석 중] GET /api/jobs/[jobId] 폴링
  → [데이터 확보] PlaceDataProvider 폴백 체인 → 정규화 → 스냅샷 저장
  → [지표 계산] 키워드 비율·경쟁 평균 대비 차이·정보 누락 여부 → Finding[] (점수 없음)
  → [RAG + LLM] 리뷰 분석 문단, 카드 문구
  → [/result/[placeId]] GET /api/places/[placeId]
  → [챗봇] POST /api/chat → 답변 + 근거 카드 + 확인 카드
  → [사장님 답변] POST /api/answers → 저장 → 다음 답변에 반영
```

### PlaceDataProvider (교체 가능한 데이터 공급자)
```ts
interface PlaceDataProvider {
  getStore(placeId: string): Promise<Store>;
  getKeywordStats(placeId: string): Promise<KeywordStat[]>;
  getReviews(placeId: string, limit: number): Promise<Review[]>;
  getCompetitors(placeId: string): Promise<Store[]>; // 사용자 지정 링크 기반
}
```
- `MockProvider`: 실제와 동일한 스키마의 가짜 데이터 (개발 기본값, `USE_MOCK_DATA=true`)
- `DemoProvider`: 미리 수집한 매장 JSON (`data/places/`) — 시연 모드
- `CrawlerProvider`: FastAPI로 감싼 Python 수집기 호출
- `ManualUploadProvider`: 엑셀/CSV 업로드 (수작업 샘플, 사장님 제공 리뷰)
- 순서: Demo → Crawler → Mock, 실패하거나 시간 초과 시 다음 공급자로

## 8. API
| 메서드 | 경로 | 입력 | 출력 |
|---|---|---|---|
| POST | `/api/analyze` | `{ url, industry }` | `{ jobId, placeId, status }` |
| GET | `/api/jobs/[jobId]` | – | `{ status: queued/collecting/analyzing/done/failed, step, placeId }` |
| GET | `/api/places/[placeId]` | – | `{ store, keywordStats, findings, reviewSummary, cards }` |
| POST | `/api/chat` | `{ placeId, message, history }` | 스트리밍 답변 + `{ intent, knowledgeIds, cards }` |
| POST | `/api/answers` | `{ placeId, cardId, answer }` | `{ ok, nextCards }` |

## 9. 공통 데이터 타입 (`types/`)
```ts
type Industry = "음식점" | "카페" | "공방" | "헬스장" | "스터디카페";

type Store = {
  placeId: string; name: string; category: string; industry: Industry; address?: string;
  rating?: number; visitorReviewCount?: number; blogReviewCount?: number;
  hasBookingTab?: boolean; tabs: string[]; amenities: string[]; intro?: string;
  representativeKeywords: string[]; coupons: string[]; photoUrl?: string;
};

type KeywordStat = { keyword: string; count: number; ratio: number }; // ratio = count / visitorReviewCount

type Review = {
  visitedDate?: string; visitCount?: number; authType?: "영수증" | "예약" | "기타";
  votedKeywords: string[]; photoCount?: number; hasOwnerReply?: boolean; ownerReply?: string;
  body: string; source: "crawler" | "octoparse" | "manual" | "mock";
}; // 작성자 닉네임·프로필·사진 파일 저장 금지

type Finding = { // 점수·가중치·우선순위 필드 없음, 사실만 담음
  id: string; type: "높음" | "낮음" | "정보";
  keyword?: string; mine?: number; competitorAvg?: number; gapPp?: number;
  category: "마케팅" | "비마케팅"; signalType: string; needsOwnerCheck: boolean;
};

type Card =
  | { id: string; kind: "발견"; text: string; findingId: string }
  | { id: string; kind: "근거"; knowledgeId: string; title: string; summary: string; strength: "강함" | "중간" | "혼재" }
  | { id: string; kind: "확인"; text: string; buttons: string[] };

type KnowledgeChunk = {
  id: string; layer: "노출" | "선택"; principle: string; category: string;
  strength: "강함" | "중간" | "혼재"; core: string[]; apply: string[];
  examples: Partial<Record<Industry, string>>; signals: string[];
  actions: string[]; caution?: string; source?: string; signalTypes: string[];
};

type OwnerAnswer = { placeId: string; cardId: string; question: string; answer: string; answeredAt: string };
type Snapshot = { snapshotId: string; placeId: string; collectedAt: string; store: Store; keywordStats: KeywordStat[] };
```

## 10. 지표 계산 규칙 (`lib/metrics/`, 점수화·LLM 사용 금지)
- 계산하는 것은 사실(수치)뿐이다. 종합 점수, 가중치, 순위, 우선순위 판단은 만들지 않는다.
- 키워드 비율 = 선택 인원 ÷ 방문자 리뷰 수 (원 숫자끼리 비교하지 않음)
- 경쟁 평균 대비 차이 = 내 비율 − 경쟁 매장 평균 비율 (%p)
- 업종별 키워드 분류표: 맛·품질 / 가격 / 응대 / 청결·시설 / 공간·분위기 / 편의 → 마케팅·비마케팅 매핑 (분류만, 점수 없음)
- 정보 확인 항목 (있음/없음 사실 표시): 업종 등록 정보, 편의시설 설정(예: 헬스장에 '포장'), 소개글 첫 두 줄 내용, 대표 키워드 유무, 예약 탭 유무
- 신호 표시: 별점 4.9 이상이면서 리뷰 수가 경쟁 매장보다 적음 등은 "신호"로만 표시하고, 해석은 지식베이스 근거로 LLM이 설명
- 최소 표본: 리뷰 수가 적으면 수치 대신 "아직 판단하기 이르다" 표시
- 운영 방식 차이일 수 있는 항목은 `needsOwnerCheck = true` → 확인 필요 카드로 사장님께 질문
- 단위 테스트 필수

## 11. 지식베이스와 LLM 규칙
- 지식 두 층위: 노출 지식(대표 키워드, 정보 완성도, 활성도) + 선택 지식(소비자 심리 원리 22개)
- 선택 지식 분류: 선택과 결정 / 신뢰와 사회적 증거 / 가격 인식 / 경험과 기억 / 행동 유지와 재방문 / 반발과 압박
- 저장: `data/knowledge/*.json` (`KnowledgeChunk` 형식), 검색은 `signalTypes`·`industry` 태그 매칭
- 가드레일(제안 금지): 가짜 희소성, 대가성 리뷰 미표시, 리뷰·트래픽 조작, 해지·환불 방해, 과장 사진·원산지 허위
- LLM 입력: 계산된 지표 JSON + 관련 지식 조각 + 사장님 이전 답변 + 대화 기록
- LLM 금지: 점수 매기기·순위 매기기, 계산된 지표에 없는 숫자, '혼재' 원리 단정, 가드레일 위반 제안, 검색되지 않은 지식 인용
- 출력은 JSON 구조(답변 본문, 사용한 knowledgeIds, 확인 질문)로 받고 서버에서 검증

## 12. 비기능 요구사항
- API 키(LLM, 수집기)는 `.env.local`과 서버에서만 사용, 브라우저 코드 노출 금지
- 수집은 작업 큐로 하나씩 처리, place_id 기준 캐시, 요청 간 대기, 소량 수집
- 개인정보: 리뷰 작성자 정보 미저장
- 모바일 화면(폭 360px 이상)에서도 레이아웃이 깨지지 않을 것
- 수집·LLM 실패 시에도 화면이 멈추지 않고 안내 문구 표시

## 13. 개발 요청 순서 (단계별로 하나씩 요청)
1. 프로젝트 생성 + 디자인 토큰 (Next.js, Tailwind, shadcn/ui, Pretendard, Figma 색상)
2. 정적 화면: `/`, `/guide`, `/result/[placeId]`를 `data/places/sample.json` Mock 데이터로 (API 연결 없이)
3. API와 화면 흐름: `/api/analyze`, `/api/jobs`, `/api/places`, 분석 중 화면, URL 검증 안내
4. `types/`와 `PlaceDataProvider` + `MockProvider`/`DemoProvider`, Mock 데이터 (음식점·카페·공방·헬스장·스터디카페 각 3곳)
5. 지표 계산 모듈 (`lib/metrics/`, 점수화 없이 비율·차이·정보 확인, 단위 테스트)
6. 지식베이스 JSON + 태그 검색 (`lib/knowledge/`)
7. 리뷰 분석 문단 생성 (`lib/llm/`)
8. 챗봇 `/api/chat`: 의도 분류, RAG, 스트리밍, 근거 카드 검증, 확인 카드
9. `/api/answers`: 사장님 답변 저장과 다음 카드 반영
10. 실제 데이터 연결: Python 수집기를 FastAPI로 감싸 `CrawlerProvider` 연결, 실패 시 폴백

각 단계 완료 기준: 실행해서 화면·API가 동작하고, 이전 단계 기능이 깨지지 않을 것 → git commit 후 다음 단계
