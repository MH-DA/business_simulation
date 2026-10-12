# 협업 규칙

## 브랜치 전략

오래 쓰는 브랜치는 `main` 하나뿐이다. 사람 이름이 붙은 브랜치(MH, YS 등)와 `develop`은 쓰지 않는다.

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| `main` | 확인이 끝난 코드. 배포(Vercel) 기준 | 실행해서 확인된 것만 병합 |
| `feature/*`, `fix/*` | 기능·수정 하나를 작업하는 임시 브랜치 | `main`에서 분기 → 작업 → PR로 `main`에 병합 → **병합하면 바로 삭제** |

`hotfix/*`와 `release/*`는 쓰지 않는다. 버전은 브랜치가 아니라 아래 "버전 관리"의 태그로 관리한다.

## 작업 순서

```bash
git checkout main && git pull
git checkout -b feature/기능-이름        # 예: feature/collector, feature/metrics-compare
# 작업 → 실행해서 확인 → 커밋
git push -u origin feature/기능-이름
# GitHub에서 PR 생성: feature/기능-이름 → main, 팀원 1명 확인 후 병합
# 병합한 뒤: 원격 브랜치 삭제, 로컬은 git checkout main && git pull && git branch -d feature/기능-이름
```

작업 브랜치는 하루 이틀 안에 끝낼 수 있는 크기로 자른다. 오래 두면 다른 사람의 변경과 충돌한다.

## 버전 관리

버전은 `main`의 특정 커밋에 붙이는 이름표(태그)다. 브랜치를 새로 만들지 않고, `main`은 계속 이어서 쓴다.

- 단계가 끝나고 실행해서 확인했을 때, 내부 데모(11/8)와 최종 발표 전에 태그를 남긴다.
- 이름 예: `v0.1`(1~5단계, 샘플 데이터) → `v0.2-demo`(실제 데이터 연결 확인) → `v1.0`(최종)
- 태그 만들기: `git tag -a v0.2-demo -m "설명" && git push origin v0.2-demo`
- 이전 버전을 보려면: `git checkout v0.1` (보고 나서는 `git checkout main`)

## 커밋 메시지

`종류: 내용` 형식으로 쓴다. 종류는 `feat`(기능), `fix`(수정), `docs`(문서), `chore`(설정·정리).

## 주의

- API 키는 `.env.local`에만 두고 커밋하지 않는다. (`.env.example`만 올린다)
- 이미지·디자인 시안은 `docs/design/`에 둔다.
