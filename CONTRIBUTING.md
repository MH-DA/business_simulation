# 협업 규칙

## 브랜치 전략 (Git Flow 간소화)

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| `main` | 확인이 끝난 코드. 배포(Vercel) 기준 | 직접 push 금지. `develop`에서 확인된 것만 병합 |
| `develop` | 통합 개발 | 직접 push 금지. `feature/*`를 PR로 병합 |
| `feature/*` | 기능 단위 작업 | `develop`에서 분기 → 작업 → PR로 `develop`에 병합 |

`hotfix/*`와 `release/*`는 쓰지 않는다. 버그는 `fix/*` 브랜치를 `develop`에서 따서 같은 방식으로 처리한다.

## 작업 순서

```bash
git checkout develop && git pull
git checkout -b feature/기능-이름        # 예: feature/home-page, feature/api-analyze, feature/chat
# 작업 → 실행해서 확인 → 커밋
git push -u origin feature/기능-이름
# GitHub에서 PR 생성: feature/기능-이름 → develop, 팀원 1명 확인 후 병합
```

## develop → main 병합 시점

- 단계가 끝나고 실행해서 확인했을 때
- 내부 데모(11/8)와 최종 발표 전
- 병합할 때는 PR로 하고 태그를 남긴다. 예: `v0.1-demo`

## 커밋 메시지

`종류: 내용` 형식으로 쓴다. 종류는 `feat`(기능), `fix`(수정), `docs`(문서), `chore`(설정·정리).

## 주의

- API 키는 `.env.local`에만 두고 커밋하지 않는다. (`.env.example`만 올린다)
- 이미지·디자인 시안은 `docs/design/`에 둔다.
