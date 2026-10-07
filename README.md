# 사장님 AI 마케팅 도우미

BA AI 경영 시뮬레이션 팀 프로젝트. 사장님이 네이버 플레이스 링크를 입력하면 공개 데이터를 근거로 가게 상태를 진단하고, 챗봇 상담으로 지금 필요한 마케팅 실행 방법을 함께 찾아주는 웹 서비스.

- 기획서: [PROJECT.md](PROJECT.md)
- 개발 워크플로우(스택, 화면↔데이터, 단계별 진행): [WORKFLOW.md](WORKFLOW.md)

## 핵심 원칙

- 점수화하지 않는다. 종합 점수·가중치·순위 없이 사실(수치)만 보여준다.
- 숫자는 지표 계산 모듈이 계산한 것만 쓰고, LLM은 지식베이스를 근거로 설명과 문구화만 한다.
- 무엇을 먼저 할지는 서비스가 정하지 않고, 근거를 보여준 뒤 사장님이 판단하도록 돕는다.
- 처음에는 Mock 데이터로 만들고, 실제 수집기는 마지막에 붙인다.

## 폴더

```
app/          화면(/ , /guide, /analyzing/[jobId], /result/[placeId])과 API route
components/   StoreCard, KeywordChip, InsightCard, EvidenceCard, ConfirmCard, ChatPanel ...
lib/
  providers/  데이터 공급자 (PlaceDataProvider 인터페이스, MockProvider)
  metrics/    지표 계산 (점수화 없음, 4단계)
  knowledge/  지식 조각 검색 (5단계)
  llm/        프롬프트, LLM 호출 (5단계)
data/
  places/     매장별 수집 결과 JSON (현재는 가짜 샘플)
  knowledge/  RAG가 읽는 지식 조각 (principles.json, guardrails.json)
types/        공통 데이터 타입
docs/
  design/     Figma 화면 이미지
  knowledge/  지식 원본 HTML (사람이 읽는 원본)
```

## 실행 방법

```bash
npm install
cp .env.example .env.local   # 필요한 키만 채운다 (Mock 개발은 비워도 됨)
npm run dev                  # http://localhost:3000
npm run typecheck            # 타입 검사 (라우트 타입을 먼저 생성한다)
npm run lint
npm run build
```

shadcn/ui 컴포넌트는 `components.json` 설정이 되어 있어서 필요할 때 추가한다: `npx shadcn@latest add button card input badge`

## 진행 상황

- [x] 폴더 뼈대, 공통 타입, Provider 인터페이스, MockProvider, 샘플 데이터
- [x] 1단계 프로젝트 생성과 디자인 토큰 (Next.js 16 + Tailwind 4 + Pretendard, 색상·둥글기는 `app/globals.css`)
- [ ] 2단계 정적 화면
- [ ] 3단계 API와 화면 흐름 (데이터 공급자 포함)
- [ ] 4단계 지표 계산 모듈
- [ ] 5단계 챗봇 (RAG + LLM)
- [ ] 6단계 실제 데이터 연결

## 참고

- 업종은 `types/index.ts`의 `INDUSTRIES`에 정의한다: 음식점, 카페, 공방, 헬스장, 스터디카페. PROJECT.md의 대상 업종에는 공방이 아직 없으니 맞춰서 갱신할 것.
- 환경변수는 `.env.example`을 복사해 `.env.local`로 만든다. API 키는 서버에서만 사용한다.
- `data/places/`의 샘플은 가짜 데이터다. 실제 매장 정보가 아니다.
