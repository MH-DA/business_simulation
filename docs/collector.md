# 수집기 사용법 (네이버 플레이스 가게 정보)

`scripts/collect_place.py`는 가게 링크를 받아 공개된 가게 정보를 모으고 `data/places/<가게번호>.json`으로 저장합니다.
리뷰 원문은 모으지 않습니다. 리뷰는 Octoparse로 따로 받아 변환기(`docs/converter.md`)로 합칩니다.

## 모으는 항목

| 묶음 | 항목 |
|---|---|
| 기본 정보 | 이름, 업종, 주소, 영업시간, 휴무일, 별점, 방문자·블로그 리뷰 수, 소개글, 편의시설, 대표 키워드, 대표 사진 |
| 플레이스 활용 | 탭 목록(예약 탭), 쿠폰, 네이버페이, 플레이스 플러스, 최근 새소식 날짜, 업체 사진 수, 인스타그램·블로그 링크 |
| 이런 점이 좋았어요 | 키워드별 선택 인원 전체, 참여 인원 |

못 찾은 항목은 "없음"이 아니라 비워 두고, 화면에는 "확인 전"으로 나옵니다.
참여 인원을 못 찾으면 비율을 계산할 수 없어 키워드 통계는 저장하지 않습니다.

## 처음 한 번만: 준비

```powershell
cd C:\경로\business_simulation
pip install -r scripts\requirements.txt
python -m playwright install chromium
```

## 수집하기

```powershell
# 링크 하나 (따옴표로 감싸기)
python scripts\collect_place.py "https://map.naver.com/p/entry/place/1500041605?lng=..."

# 여러 곳: 가게 번호나 naver.me 공유 링크도 됩니다
python scripts\collect_place.py 1500041605 1618293502 "https://naver.me/FdCLCNV0"

# 목록 파일 (한 줄에 하나)
python scripts\collect_place.py --file 가게목록.txt
```

| 옵션 | 언제 |
|---|---|
| `--industry 스터디카페` | 업종이 "장소대여"처럼 나와 자동으로 못 정할 때 |
| `--dry-run` | 저장하지 않고 결과만 볼 때 |
| `--show` | 브라우저 창을 띄워 진행 과정을 볼 때 |
| `--pause 5` | 페이지 사이를 더 천천히 (기본 3~5초) |

이미 Octoparse 리뷰를 합친 파일이 있으면, 다시 수집해도 리뷰는 그대로 둡니다.

## 결과 읽기

가게마다 `찾음 N개`, `확인 전 N개`가 나옵니다. 확인 전이 많으면 `data\raw\<가게번호>\` 폴더를 압축해 Claude나 개발 담당에게 보내 주세요.
이 폴더는 화면 원본이라 수집기를 고칠 때 씁니다. 리뷰 작성자 정보는 지우고 저장하며, 깃에는 올라가지 않습니다.

## 지키는 것

- 봇 확인(자동입력 방지) 화면이 뜨면 우회하지 않고 멈춥니다. 한참 뒤에 다시 시도하세요.
- 한 번에 많은 가게를 돌리지 마세요. 사용자 테스트에 필요한 가게만 모읍니다.
- 공개 정보만 모으고, 리뷰 작성자 같은 개인정보는 저장하지 않습니다.

## 테스트

```powershell
python -m unittest scripts/test_collect_place.py -v
```
네이버에 접속하지 않고 가짜 페이지 데이터로 값 찾기만 확인합니다.
