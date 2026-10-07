# 사장님 AI 마케팅 도우미 — 웹 프로토타입 개발 워크플로우

BA AI 경영 시뮬레이션 팀 프로젝트

---

## 0. 서비스 한 줄 요약

사장님이 네이버 플레이스 링크를 입력하면, 공개 데이터를 근거로 가게 상태를 진단하고
챗봇 상담으로 지금 필요한 마케팅 실행 방법을 함께 찾아주는 웹 서비스.

**핵심 원칙**
- 판단은 규칙 기반 진단 엔진이 한다. LLM은 판단 결과를 설명하고 문구로 만드는 역할만 한다.
- 숫자는 엔진이 계산한 것만 화면에 쓴다.
- 데이터로 알 수 없는 것은 사장님께 되묻는다 (확인 필요 카드).
- 처음부터 크롤러를 붙이지 않는다. Mock 데이터로 화면과 챗봇을 먼저 완성하고, 실제 수집기는 마지막에 연결한다.

---

## 1. 기술 스택

| 영역 | 사용 기술 | 이유 |
|---|---|---|
| 화면 + 서버 | Next.js (App Router) + TypeScript | 화면과 API를 한 프로젝트에서 관리, 바이브 코딩 도구가 가장 잘 다룸 |
| 스타일 | Tailwind CSS + shadcn/ui | Figma의 카드·칩·버튼 스타일을 옮기기 쉬움 |
| LLM | Claude 또는 OpenAI API (서버에서만 호출) | 챗봇 답변, 리뷰 분석 문단 |
| 수집기 | 기존 Python 수집기 → 이후 FastAPI로 감싸기 | 처음에는 수집 결과 JSON만 사용 |
| 저장 | JSON 파일 → 이후 SQLite 또는 Supabase | 프로토타입은 파일로 충분 |
| 배포 | Vercel | Next.js 무료 배포 |
| 협업 | GitHub 저장소 1개 | 폴더 기준으로 담당 영역 분리 |

---

## 2. 화면 구성 (Figma 기준)

| Figma 화면 | 주소 (route) | 사용하는 API / 데이터 |
|---|---|---|
| 01 시작 페이지 | `/` | `POST /api/analyze` |
| 플레이스 링크 찾는 방법 | `/guide` | 없음 (정적 화면) |
| 분석 중 *(추가 예정)* | `/analyzing/[jobId]` | `GET /api/jobs/[jobId]` |
| 02 분석 결과 + 03·04 챗봇 상담 | `/result/[placeId]` | `GET /api/places/[placeId]`, `POST /api/chat` |

> 02 하단의 "아래로 내려 상담 시작하기"처럼 02와 03·04는 한 페이지에서 스크롤로 이어지는 구조.
> 스크롤하면 상단 가게 카드가 03처럼 한 줄로 축소된다.

### 02 분석 결과 화면 ↔ 데이터

| 화면 영역 | 데이터 출처 |
|---|---|
| 가게 카드 (이름, 업종, 주소, 별점) | 수집기 `store` |
| 현재 확인된 키워드 칩 | 대표 키워드 (없으면 선택 키워드 상위) |
| 자주 언급되는 강점 | 선택 키워드 비율 상위 + 진단 엔진 강점 |
| 자주 언급되는 불편 사항 | 진단 엔진 약점 (리뷰 원문이 있으면 부정 표현 추출) |
| 리뷰 분석 문단 | 엔진 결과를 LLM이 문장으로 정리 |

### 03·04 챗봇 상담 ↔ 답변 방식

| 사장님 질문 유형 | 답변 방식 | 예시 |
|---|---|---|
| "왜 이런 거예요?" | 진단 설명형 | 별점은 높은데 왜 손님이 안 늘까요? |
| "어떻게 해요?" | 실행안 생성형 | 리뷰 요청 문구 만들어줘 |
| "이렇게 해도 될까요?" | 판단 보조형 → 확인 필요 카드로 되묻기 | 가격 올려도 될까요? |

### 카드 종류

| 카드 | 내용 | 출처 | 스타일 |
|---|---|---|---|
| 발견 카드 | 우리 가게의 사실과 숫자 | 진단 엔진 | 차분한 회색·네이비, 버튼 없음 |
| 근거 카드 | 그 사실이 왜 중요한지 (마케팅 원리) | 지식베이스 (RAG) | 답변 옆 작은 카드, 근거 강도 배지 |
| 확인 필요 카드 | 사장님께 묻는 질문 | 사장님 답변 저장 | 주황 계열, 선택 버튼 |

---

## 3. 전체 데이터 흐름

```
[01 URL 입력]
   │  POST /api/analyze { url, industry }
   ▼
[수집 작업 생성]  place_id 추출 → 저장된 결과 있으면 바로 완료 / 없으면 job 발급
   ▼
[분석 중 화면]   GET /api/jobs/[jobId] 로 진행 상태 확인
   ▼
[데이터 수집]    Provider 순서대로 시도 (시연 데이터 → 크롤러 → Mock), 스냅샷 저장
   ▼
[진단 엔진]      키워드 비율, 경쟁 격차, 정보 완성도 → 강점/약점, 문제 유형
   ▼
[RAG + LLM]     문제 유형으로 지식 조각 검색 → 리뷰 분석 문단, 카드 문구 생성
   ▼
[02 분석 결과]   가게 카드, 강점/불편 사항, 리뷰 분석
   ▼
[03·04 챗봇]    질문 → 의도 분류 → 엔진 결과 + 지식 → 답변 + 근거 카드 + 확인 질문
                사장님 답변 저장 → 다음 진단에 반영 (반복)
```

---

## 4. 폴더 구조

```
place-ai/
├── PROJECT.md                     # 기획서 (바이브 코딩 도구에 매번 참고시킴)
├── app/
│   ├── page.tsx                   # 01 시작 페이지
│   ├── guide/page.tsx             # 링크 찾는 방법
│   ├── analyzing/[jobId]/page.tsx # 분석 중
│   ├── result/[placeId]/page.tsx  # 02 분석 결과 + 03·04 챗봇
│   └── api/
│       ├── analyze/route.ts
│       ├── jobs/[jobId]/route.ts
│       ├── places/[placeId]/route.ts
│       └── chat/route.ts
├── components/                    # StoreCard, KeywordChip, InsightCard, EvidenceCard,
│                                  # ConfirmCard, ChatPanel, FaqChips ...
├── lib/
│   ├── providers/                 # MockProvider, CrawlerProvider (교체 가능한 데이터 공급자)
│   ├── engine/                    # 진단 엔진
│   ├── knowledge/                 # 지식 조각 검색 (RAG)
│   └── llm/                       # 프롬프트, LLM 호출
├── data/
│   ├── places/                    # 매장별 수집 결과 JSON
│   └── knowledge/                 # 마케팅 지식 조각 JSON
└── types/                         # 공통 데이터 타입
```

---

## 5. 공통 데이터 타입 (팀 전원이 먼저 합의)

`types/`의 형식만 처음에 확정해두면 각자 Mock으로 작업하다가 나중에 합쳐도 맞물린다.

```ts
type Store = {
  placeId: string; name: string; category: string; address?: string;
  rating?: number; visitorReviewCount?: number; blogReviewCount?: number;
  hasBookingTab?: boolean; amenities: string[]; intro?: string;
  representativeKeywords: string[]; industry: "음식점" | "카페" | "공방" | "헬스장" | "스터디카페";
};

type KeywordStat = { keyword: string; count: number; ratio: number }; // ratio = count / visitorReviewCount

type Finding = {
  type: "강점" | "약점" | "정보"; keyword?: string;
  mine?: number; competitorAvg?: number; gapPp?: number;
  category: "마케팅" | "비마케팅"; problemType: string; needsOwnerCheck: boolean;
};

type Card =
  | { kind: "발견"; text: string; findingId: string }
  | { kind: "근거"; knowledgeId: string; title: string; strength: "강함" | "중간" | "혼재" }
  | { kind: "확인"; text: string; buttons: string[] };

type KnowledgeChunk = {
  id: string; principle: string; category: string; strength: "강함" | "중간" | "혼재";
  core: string[]; apply: string[]; examples: Partial<Record<Store["industry"], string>>;
  signals: string[]; caution?: string; source?: string; problemTypes: string[];
};
```

---

## 6. 바이브 코딩 단계별 진행

**규칙**
- 한 번에 한 단계만 요청한다. "웹 전부 만들어줘"는 금지.
- 요청할 때마다 "PROJECT.md 기준으로"를 붙이고, 관련 Figma 스크린샷을 첨부한다.
- 단계가 끝날 때마다 실행해서 확인 → git commit.
- API 키는 `.env.local`에만 두고 브라우저 코드에 넣지 않는다.

### 1단계 · 프로젝트 생성과 디자인 토큰
```
Next.js(App Router, TypeScript) + Tailwind + shadcn/ui 프로젝트를 만들어줘.
첨부한 Figma 스크린샷 기준으로 색상(메인 진초록, 연한 민트 배경, 칩 색), 글꼴(Pretendard),
카드 둥글기와 테두리를 Tailwind 테마로 정의해줘.
```
완료 기준: 빈 페이지에 테마 색상과 글꼴이 적용됨

### 2단계 · 정적 화면 (Mock 데이터)
```
01 시작 페이지와 링크 찾는 방법 페이지를 스크린샷과 똑같이 만들어줘.
02 분석 결과 + 03 챗봇 시작 화면을 /result/[placeId] 한 페이지로 만들고,
data/places/sample.json의 가짜 데이터로 채워줘. 아직 API 연결은 하지 마.
```
완료 기준: 세 화면이 Figma와 같은 모습으로 보임, 스크롤 시 가게 카드 축소

### 3단계 · API와 화면 흐름 연결
```
POST /api/analyze: URL에서 place_id를 추출하고 job을 만들어줘.
data/places에 해당 매장 JSON이 있으면 바로 완료 처리하고, 없으면 "수집 필요" 상태로 둬.
01 화면 버튼을 누르면 분석 중 화면을 거쳐 /result/[placeId]로 이동하게 해줘.
잘못된 URL이면 입력창 아래에 안내 문구를 보여줘.
```
완료 기준: URL 입력 → 분석 중 → 결과 화면까지 끊김 없이 이동

### 4단계 · 진단 엔진
```
lib/engine에 진단 엔진을 만들어줘. 선택 키워드 인원을 방문자 리뷰 수로 나눈 비율,
경쟁 매장 평균과의 차이(%p), 기준을 넘는 항목의 강점/약점 분류를 계산해.
LLM은 쓰지 말고 규칙으로만 계산하고, 단위 테스트도 같이 만들어줘.
```
완료 기준: 수집 데이터 JSON을 넣으면 Finding 목록이 나오고 테스트 통과
※ 가중치와 기준값은 팀의 판단 기준표를 그대로 넘긴다 (팀 핵심 산출물)

### 5단계 · 챗봇 (RAG + LLM)
```
POST /api/chat: 사장님 질문을 진단 설명형/실행안 생성형/판단 보조형으로 분류하고,
의도에 맞는 엔진 결과와 data/knowledge의 지식 조각을 골라 LLM에 넘겨줘.
LLM은 답변과 함께 사용한 지식 ID를 내보내고, 서버는 그 ID가 실제 검색 결과에 있을 때만
근거 카드로 표시해. 판단 보조형은 결론 대신 확인 필요 카드(버튼)로 끝내.
답변은 스트리밍으로 보여주고, API 키는 서버 환경변수에만 둬.
```
완료 기준: 자주 묻는 질문 4개를 눌렀을 때 답변 + 근거 카드 + (필요 시) 확인 버튼 표시
※ 프롬프트 공통 규칙: 엔진 결과에 없는 숫자 금지 / 근거 '혼재' 원리 단정 금지 / 가드레일 위반 제안 금지

### 6단계 · 실제 데이터 연결
```
Python 수집기를 FastAPI로 감싸서 POST /collect {url}을 받으면 결과 JSON을 돌려주게 해줘.
Next.js의 CrawlerProvider가 이걸 호출하고, 실패하거나 시간이 오래 걸리면 MockProvider로 넘어가게 해줘.
```
완료 기준: 새 매장 URL을 넣으면 실제 데이터로 결과가 나오고, 실패해도 화면이 멈추지 않음
