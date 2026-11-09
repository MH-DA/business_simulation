"""수집 결과 변환기: 수집기 JSON + Octoparse 리뷰(엑셀/CSV) → CollectedPlace JSON

types/index.ts 의 CollectedPlace 형식으로 바꿔 data/places/<placeId>.json 에 저장한다.

지키는 원칙 (프로젝트 지침 2·4장)
- 수집하지 못한 값은 false/0 으로 채우지 않고 비워 둔다. 화면은 이것을 "확인 전"으로 보여준다.
- 리뷰는 아는 열만 골라 담는다(허용 목록 방식). 작성자·링크·팔로워 같은 열은 값을 읽지도 저장하지도 않는다.
- 키워드 비율의 분모는 "이런 점이 좋았어요" 참여 인원이다(방문자 리뷰 수가 아님).
- 숫자는 원본에 있는 것만 옮긴다. 없는 숫자를 추정해서 만들지 않는다.

사용 예 (PowerShell, 저장소 폴더에서)
  python scripts\\convert_place.py --store 수집결과.json --reviews 리뷰.xlsx
  python scripts\\convert_place.py --store 수집결과.json --reviews 리뷰.csv --industry 카페
  python scripts\\convert_place.py --store data\\places\\1234567.json --reviews 새리뷰.xlsx --force
  python scripts\\convert_place.py --store 수집결과.json --reviews 리뷰.xlsx --map "Text1=body" --map "Field3=방문일"

필요한 패키지: openpyxl (엑셀을 읽을 때만)  →  pip install openpyxl
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import re
import sys
from pathlib import Path
from typing import Any

KST = dt.timezone(dt.timedelta(hours=9))
INDUSTRIES = ("음식점", "카페", "공방", "헬스장", "스터디카페")
SOURCES = ("crawler", "octoparse", "manual", "mock", "demo")

# Store 에서 비어 있으면 화면에 "확인 전"으로 나오는 선택 항목
OPTIONAL_STORE_FIELDS = (
    "address", "photoUrl", "rating", "visitorReviewCount", "blogReviewCount", "hasBookingTab",
    "intro", "hasNaverPay", "lastNewsDate", "closedDays", "openHours", "ownerPhotoCount",
    "hasPlacePlus", "instagramUrl", "blogUrl", "keywordParticipants",
)


def norm_key(key: Any) -> str:
    """열 이름 비교용: 공백·기호를 지우고 소문자로. '방문자 리뷰 수' → '방문자리뷰수'"""
    return re.sub(r"[\s_\-·.:/()\[\]]", "", str(key)).lower()


def _aliases(table: dict[str, list[str]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for target, names in table.items():
        for name in [target, *names]:
            out[norm_key(name)] = target
    return out


# ---------------------------------------------------------------------------
# 가게 정보 (수집기 결과) 열 이름 → Store 필드
# 수집기 v6.1 의 실제 키 이름이 여기 없으면 목록에 추가하거나 --store-map 을 쓴다.
STORE_ALIASES = _aliases({
    "placeId": ["place_id", "id", "플레이스id", "가게번호", "업체id"],
    "url": ["place_url", "링크", "플레이스링크", "주소링크"],
    "name": ["store_name", "place_name", "이름", "업체명", "가게명", "상호", "상호명"],
    "category": ["업종", "카테고리", "업태"],
    "industry": ["대상업종", "서비스업종"],
    "address": ["road_address", "주소", "도로명주소", "지번주소"],
    "photoUrl": ["photo_url", "image_url", "대표사진", "대표사진url"],
    "rating": ["star", "score", "별점", "평점"],
    "visitorReviewCount": ["visitor_review_count", "visitor_reviews", "방문자리뷰수", "방문자리뷰"],
    "blogReviewCount": ["blog_review_count", "blog_reviews", "블로그리뷰수", "블로그리뷰"],
    "hasBookingTab": ["has_booking_tab", "booking", "booking_tab", "예약탭", "예약탭유무", "예약가능"],
    "tabs": ["tab_list", "탭", "탭목록"],
    "amenities": ["facilities", "편의시설", "편의시설및서비스"],
    "intro": ["introduction", "description", "소개", "소개글", "가게소개"],
    "representativeKeywords": ["representative_keywords", "keywords", "대표키워드"],
    "coupons": ["coupon", "쿠폰"],
    "hasNaverPay": ["naver_pay", "naverpay", "네이버페이"],
    "lastNewsDate": ["last_news_date", "news_date", "최근새소식", "최근새소식날짜", "새소식날짜"],
    "closedDays": ["closed_days", "holiday", "휴무일", "정기휴무"],
    "openHours": ["open_hours", "business_hours", "hours", "영업시간"],
    "ownerPhotoCount": ["owner_photo_count", "photo_count", "업체사진수", "업체사진", "사진수"],
    "hasPlacePlus": ["place_plus", "플레이스플러스"],
    "instagramUrl": ["instagram", "instagram_url", "인스타그램", "인스타그램링크"],
    "blogUrl": ["blog", "blog_url", "블로그", "블로그링크"],
    "keywordParticipants": ["keyword_participants", "participants", "참여인원", "키워드참여인원",
                            "이런점이좋았어요참여인원"],
    "keywordStats": ["keyword_stats", "voted_keywords", "키워드통계", "이런점이좋았어요", "선택키워드통계"],
    "collectedAt": ["collected_at", "crawled_at", "수집시각", "수집일시", "수집일"],
})

# ---------------------------------------------------------------------------
# 리뷰 (Octoparse) 열 이름 → Review 필드. 여기 있는 열만 저장한다.
REVIEW_ALIASES = _aliases({
    "body": ["text", "content", "review", "review_text", "본문", "리뷰", "리뷰내용", "리뷰본문", "내용"],
    "visitedDate": ["visited_date", "visit_date", "방문일", "방문날짜", "방문일자", "방문시간"],
    "createdDate": ["created_date", "write_date", "작성일", "작성날짜", "작성일자"],
    "visitCount": ["visit_count", "방문횟수", "방분횟수", "방문차수", "방문회차", "n번째방문"],
    "authType": ["auth_type", "auth", "인증수단", "인증", "인증방법", "방문인증"],
    "photoCount": ["photo_count", "사진수", "사진개수", "리뷰사진수", "첨부이미지", "첨부사진"],
    "ownerReply": ["owner_reply", "reply", "사장님답글", "답글", "사장님댓글", "답글내용"],
    "hasOwnerReply": ["has_owner_reply", "답글여부", "사장님답글여부"],
    "votedKeywords": ["voted_keywords", "keywords", "선택키워드", "키워드", "이런점이좋았어요", "이런점이좋아요"],
})

REVIEW_FIELDS = set(REVIEW_ALIASES.values())

# 개인정보라 저장하지 않는 열 (값은 읽지 않고 열 이름만 결과에 보고한다)
BLOCKED_REVIEW_COLUMNS = {
    norm_key(k) for k in (
        "작성자", "작성자명", "닉네임", "이름", "author", "nickname", "writer", "user", "username",
        "프로필", "프로필사진", "profile", "avatar",
        "링크", "url", "link", "리뷰링크", "작성자링크", "page_url",
        "팔로워", "팔로워수", "follower", "followers",
        "작성자리뷰수", "리뷰어리뷰수", "작성자사진수", "리뷰작성자", "리뷰작성자링크", "리뷰작성수",
        "이미지", "이미지url", "사진url", "image", "image_url", "photo_url",
    )
}

# Octoparse 리뷰 파일에 줄마다 반복되는 가게 단위 열. 리뷰로 저장하지 않고, 가게 번호가 맞는지 확인하는 데만 쓴다.
REVIEW_FILE_STORE_COLUMNS = {norm_key(k) for k in (
    "유입_URL", "도입_URL", "입력URL", "URL", "가게이름", "업체명", "카테고리", "업종", "전체평점", "별점",
    "방문자리뷰", "블로그리뷰", "방문자리뷰수", "블로그리뷰수",
)}
URL_COLUMNS = {norm_key(k) for k in ("유입_URL", "도입_URL", "입력URL", "URL")}

PHONE_RE = re.compile(r"01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}")
INTRO_NOISE_RE = re.compile(r"\s*(펼쳐보기|접기|더보기|내용 더보기)\s*$")


class ConvertError(Exception):
    """사용자가 고쳐야 하는 문제 (메시지를 그대로 보여준다)"""


# ---------------------------------------------------------------------------
# 값 정리 함수


def is_blank(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return v.strip() in ("", "-", "null", "None", "확인 전", "확인전", "N/A", "nan")
    return False  # 빈 목록은 "없음"이라는 사실일 수 있어 비어 있다고 보지 않는다


def to_int(v: Any) -> int | None:
    if is_blank(v) or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    m = re.search(r"\d[\d,]*", str(v))
    return int(m.group().replace(",", "")) if m else None


def to_float(v: Any) -> float | None:
    if is_blank(v) or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"\d+(?:\.\d+)?", str(v))
    return float(m.group()) if m else None


TRUE_WORDS = {"true", "y", "yes", "o", "1", "있음", "있어요", "사용", "사용중", "가능", "예", "네"}
FALSE_WORDS = {"false", "n", "no", "x", "0", "없음", "없어요", "미사용", "불가", "불가능", "아니요", "아니오"}


def to_bool(v: Any) -> bool | None:
    """모르는 값이면 None (= 확인 전). 절대 False 로 짐작하지 않는다."""
    if is_blank(v):
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    s = norm_key(v)
    if s in TRUE_WORDS:
        return True
    if s in FALSE_WORDS:
        return False
    return None


def to_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        items = v
    else:
        items = re.split(r"[,\n|/]", str(v))
    out = []
    for item in items:
        if isinstance(item, dict):  # [{"name": "주차"}] 같은 형태
            item = item.get("name") or item.get("keyword") or item.get("text") or ""
        s = str(item).strip().lstrip("#").strip()
        if s and s not in out:
            out.append(s)
    return out


def to_str(v: Any) -> str | None:
    if is_blank(v):
        return None
    return re.sub(r"[ \t]+", " ", str(v)).strip()


def parse_date(v: Any, ref: dt.date) -> str | None:
    """'2026.9.20', '26.9.20.', '9.20.토', '2026년 9월 20일', '2026-09-20', 엑셀 날짜 → '2026-09-20'
    연도가 없으면 기준일(수집일)의 연도로 보고, 기준일보다 뒤면 1년 전으로 본다."""
    if is_blank(v):
        return None
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    s = str(v).strip()
    m = re.search(r"(\d{4}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", s)
    has_year = m is not None
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
    else:
        m = re.search(r"(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", s)
        if not m:
            return None
        y, mo, d = ref.year, int(m.group(1)), int(m.group(2))
    try:
        date = dt.date(y, mo, d)
    except ValueError:
        return None
    if not has_year and date > ref:
        date = date.replace(year=date.year - 1)
    return date.isoformat()


def parse_auth(v: Any) -> str | None:
    s = to_str(v)
    if not s:
        return None
    if "영수증" in s:
        return "영수증"
    if "예약" in s:
        return "예약"
    return "기타"


def mask_phone(text: str) -> str:
    return PHONE_RE.sub("[전화번호 삭제]", text)


def clean_intro(text: str) -> str:
    return INTRO_NOISE_RE.sub("", text).strip()


def place_id_from_url(url: str) -> str | None:
    """lib/place-url.ts 와 같은 규칙: 경로에서 5자리 이상 숫자"""
    m = re.search(r"https?://[^\s]+", url or "")
    if not m:
        return None
    path = re.sub(r"^https?://[^/]+", "", m.group()).split("?")[0]
    for seg in path.split("/"):
        if re.fullmatch(r"\d{5,}", seg):
            return seg
    return None


INDUSTRY_HINTS = (
    ("스터디카페", ("스터디카페", "스터디 카페", "독서실", "스터디룸")),
    ("헬스장", ("헬스", "피트니스", "fitness", "gym", "짐")),
    ("공방", ("공방", "원데이", "클래스", "공예", "도예", "체험")),
    ("카페", ("카페", "커피", "디저트", "베이커리", "제과", "빵", "찻집")),
    ("음식점", ("음식점", "식당", "한식", "중식", "일식", "양식", "분식", "고기", "구이", "치킨", "피자",
             "국밥", "냉면", "초밥", "돈가스", "주점", "술집", "포차", "이자카야", "뷔페", "요리", "족발",
             "보쌈", "찌개", "국수", "회", "해물", "곱창", "버거", "샐러드")),
)


def infer_industry(category: str | None) -> str | None:
    if not category:
        return None
    c = category.lower()
    for industry, words in INDUSTRY_HINTS:
        if any(w in c for w in words):
            return industry
    return None


# ---------------------------------------------------------------------------
# 가게 정보 변환


def flatten(obj: Any, out: dict[str, Any] | None = None) -> dict[str, Any]:
    """중첩된 dict 를 한 겹으로. 같은 키가 여러 번 나오면 먼저 나온 값을 쓴다."""
    out = {} if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, dict) and norm_key(k) not in STORE_ALIASES:
                flatten(v, out)
            else:
                out.setdefault(str(k), v)
    return out


def parse_keyword_stats(raw: Any) -> list[tuple[str, int]]:
    """[{keyword, count}] / [[keyword, count]] / {keyword: count} / [{"text":..,"votes":..}] 모두 받는다."""
    pairs: list[tuple[str, int]] = []
    if isinstance(raw, dict):
        raw = list(raw.items())
    if not isinstance(raw, list):
        return pairs
    for item in raw:
        if isinstance(item, dict):
            kw = item.get("keyword") or item.get("text") or item.get("name") or item.get("키워드")
            cnt = next((item[k] for k in ("count", "votes", "vote", "인원", "선택인원", "cnt") if k in item), None)
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            kw, cnt = item[0], item[1]
        else:
            continue
        kw_s, cnt_i = to_str(kw), to_int(cnt)
        if kw_s and cnt_i is not None:
            pairs.append((kw_s.strip('"“”'), cnt_i))
    return pairs


def convert_store(raw: dict[str, Any], *, industry: str | None = None, place_id: str | None = None,
                  participants: int | None = None, extra_map: dict[str, str] | None = None,
                  report: dict[str, list[str]] | None = None) -> tuple[dict[str, Any], list[dict[str, Any]], str | None]:
    """수집기 결과 dict → (store, keywordStats, collectedAt)"""
    report = report if report is not None else {"warnings": [], "unknown": []}
    aliases = dict(STORE_ALIASES)
    for src, dst in (extra_map or {}).items():
        aliases[norm_key(src)] = dst

    flat = flatten(raw)
    vals: dict[str, Any] = {}
    for key, value in flat.items():
        target = aliases.get(norm_key(key))
        if target is None:
            report["unknown"].append(key)
            continue
        vals.setdefault(target, value)

    store: dict[str, Any] = {}

    pid = place_id or to_str(vals.get("placeId"))
    if not pid and vals.get("url"):
        pid = place_id_from_url(str(vals["url"]))
    if not pid:
        raise ConvertError("가게 번호(placeId)를 찾지 못했어요. --place-id 1234567 처럼 직접 넣어 주세요.")
    store["placeId"] = re.sub(r"\.0$", "", str(pid))

    name = to_str(vals.get("name"))
    if not name:
        raise ConvertError("가게 이름을 찾지 못했어요. 수집 결과에 이름(name/업체명) 항목이 있는지 확인해 주세요.")
    store["name"] = name
    store["category"] = to_str(vals.get("category")) or ""

    for key in ("address", "photoUrl", "closedDays", "openHours", "instagramUrl", "blogUrl"):
        s = to_str(vals.get(key))
        if s:
            store[key] = s

    rating = to_float(vals.get("rating"))
    if rating is not None:
        if 0 <= rating <= 5:
            store["rating"] = rating
        else:
            report["warnings"].append(f"별점 값이 이상해서 비워 뒀어요: {vals.get('rating')!r}")

    for key in ("visitorReviewCount", "blogReviewCount", "ownerPhotoCount", "keywordParticipants"):
        n = to_int(vals.get(key))
        if n is not None:
            store[key] = n
    if participants is not None:
        store["keywordParticipants"] = participants

    tabs = to_list(vals.get("tabs"))
    store["tabs"] = tabs
    booking = to_bool(vals.get("hasBookingTab"))
    if booking is None and tabs:
        booking = any("예약" in t for t in tabs)  # 탭 목록이 있으면 그 사실로 판단
    if booking is not None:
        store["hasBookingTab"] = booking

    for key in ("hasNaverPay", "hasPlacePlus"):
        b = to_bool(vals.get(key))
        if b is not None:
            store[key] = b
        elif not is_blank(vals.get(key)):
            report["warnings"].append(f"{key} 값을 있음/없음으로 읽지 못해 '확인 전'으로 뒀어요: {vals.get(key)!r}")

    intro = to_str(vals.get("intro"))
    if intro:
        store["intro"] = clean_intro(intro)

    store["amenities"] = to_list(vals.get("amenities"))
    store["representativeKeywords"] = to_list(vals.get("representativeKeywords"))
    store["coupons"] = to_list(vals.get("coupons"))

    collected_at = to_str(vals.get("collectedAt"))
    ref = _ref_date(collected_at)
    news = parse_date(vals.get("lastNewsDate"), ref)
    if news:
        store["lastNewsDate"] = news

    ind = industry or to_str(vals.get("industry"))
    if ind and ind not in INDUSTRIES:
        ind = infer_industry(ind)
    ind = ind or infer_industry(store["category"])
    if not ind:
        raise ConvertError(
            f"업종 '{store['category']}'을(를) 대상 업종으로 나누지 못했어요. "
            f"--industry 로 {', '.join(INDUSTRIES)} 중 하나를 넣어 주세요."
        )
    store["industry"] = ind

    pairs = parse_keyword_stats(vals.get("keywordStats"))
    stats: list[dict[str, Any]] = []
    if pairs:
        denom = store.get("keywordParticipants")
        if not denom:
            raise ConvertError(
                "키워드 통계는 있는데 '이런 점이 좋았어요' 참여 인원이 없어요. 비율의 분모가 참여 인원이라 "
                "계산할 수 없어요. 수집 결과에 참여 인원을 넣거나 --participants 숫자로 넣어 주세요."
            )
        pairs.sort(key=lambda p: -p[1])
        for kw, cnt in pairs:
            if cnt > denom:
                report["warnings"].append(f"'{kw}' 선택 인원({cnt})이 참여 인원({denom})보다 많아요. 원본을 확인해 주세요.")
            stats.append({"keyword": kw, "count": cnt, "ratio": round(cnt / denom, 4)})

    return store, stats, collected_at


def _ref_date(collected_at: str | None) -> dt.date:
    if collected_at:
        d = parse_date(collected_at, dt.datetime.now(KST).date())
        if d:
            return dt.date.fromisoformat(d)
    return dt.datetime.now(KST).date()


# ---------------------------------------------------------------------------
# 리뷰 변환


def read_table(path: Path) -> list[dict[str, Any]]:
    """엑셀(.xlsx) 첫 시트 또는 CSV 를 읽어 행 목록으로. 첫 줄이 열 이름."""
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError as e:
            raise ConvertError("엑셀을 읽으려면 openpyxl 이 필요해요. PowerShell 에서 pip install openpyxl 을 실행해 주세요.") from e
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        rows = list(wb.worksheets[0].iter_rows(values_only=True))
        wb.close()
    elif suffix in (".csv", ".tsv", ".txt"):
        data = path.read_bytes()
        for enc in ("utf-8-sig", "cp949"):
            try:
                text = data.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ConvertError(
                f"{path.name} 의 한글이 깨진 채로 저장돼 있어 읽을 수 없어요. CSV를 엑셀이나 메모장으로 열었다가 "
                "저장하면 이렇게 될 수 있어요. Octoparse 에서 엑셀(.xlsx)로 다시 내보내 주세요.")
        delim = "\t" if suffix == ".tsv" else ","
        rows = list(csv.reader(io.StringIO(text, newline=""), delimiter=delim))  # 리뷰 안 줄바꿈 유지
    else:
        raise ConvertError(f"리뷰 파일은 .xlsx 또는 .csv 여야 해요: {path.name}")
    if not rows:
        return []
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [dict(zip(header, r)) for r in rows[1:]]


def convert_reviews(rows: list[dict[str, Any]], *, ref: dt.date, extra_map: dict[str, str] | None = None,
                    report: dict[str, list[str]] | None = None, place_id: str | None = None) -> list[dict[str, Any]]:
    report = report if report is not None else {"warnings": [], "unknown": [], "blocked": []}
    report.setdefault("blocked", [])
    if not rows:
        return []

    aliases = dict(REVIEW_ALIASES)
    for src, dst in (extra_map or {}).items():
        aliases[norm_key(src)] = REVIEW_ALIASES.get(norm_key(dst), dst)

    columns: dict[str, str] = {}  # 원본 열 이름 → Review 필드
    for col in rows[0].keys():
        k = norm_key(col)
        if k in BLOCKED_REVIEW_COLUMNS:  # 개인정보 열은 --map 으로도 열 수 없다
            report["blocked"].append(col)
        elif k in aliases and aliases[k] in REVIEW_FIELDS:
            if aliases[k] not in columns.values():
                columns[col] = aliases[k]
        elif k in REVIEW_FILE_STORE_COLUMNS or not k:
            continue  # 줄마다 반복되는 가게 정보 또는 빈 열
        else:
            report["unknown"].append(col)

    # 다른 가게의 리뷰 파일을 잘못 넣지 않았는지 확인
    if place_id:
        url_col = next((c for c in rows[0].keys() if norm_key(c) in URL_COLUMNS), None)
        found = {place_id_from_url(str(r.get(url_col) or "")) for r in rows[:20]} - {None} if url_col else set()
        if found and place_id not in found:
            raise ConvertError(
                f"리뷰 파일의 가게 번호({', '.join(sorted(found))})가 가게 정보({place_id})와 달라요. "
                "다른 가게의 리뷰 파일을 넣은 것 같아요."
            )

    if "body" not in columns.values():
        raise ConvertError(
            "리뷰 본문 열을 찾지 못했어요. 열 이름을 '본문'으로 바꾸거나 --map \"원래열이름=body\" 로 알려 주세요. "
            f"지금 열: {', '.join(c for c in rows[0].keys() if c)}"
        )

    reviews = []
    for row in rows:
        v = {target: row.get(col) for col, target in columns.items()}
        body = to_str(v.get("body")) or ""
        if not body and all(is_blank(x) for x in v.values()):
            continue  # 빈 줄
        r: dict[str, Any] = {}
        for key in ("visitedDate", "createdDate"):
            d = parse_date(v.get(key), ref)
            if d:
                r[key] = d
        n = to_int(v.get("visitCount"))
        if n is None and isinstance(v.get("visitCount"), str) and "첫" in v["visitCount"]:
            n = 1
        if n is not None:
            r["visitCount"] = n
        auth = parse_auth(v.get("authType"))
        if auth:
            r["authType"] = auth
        r["votedKeywords"] = [k.strip('"“”') for k in to_list(v.get("votedKeywords"))]
        pc = to_int(v.get("photoCount"))
        if pc is not None:
            r["photoCount"] = pc
        reply = to_str(v.get("ownerReply"))
        has_reply = to_bool(v.get("hasOwnerReply")) if "hasOwnerReply" in v else None
        if has_reply is None and "ownerReply" in v:
            has_reply = bool(reply)
        if has_reply is not None:
            r["hasOwnerReply"] = has_reply
        if reply:
            r["ownerReply"] = mask_phone(reply)
        r["body"] = mask_phone(body)
        r["source"] = "octoparse"
        reviews.append(r)

    # Octoparse 가 페이지를 넘기며 같은 리뷰를 두 번 담는 경우가 있어 한 번만 남긴다
    seen: set[tuple[Any, ...]] = set()
    unique = []
    for r in reviews:
        key = (r["body"], r.get("visitedDate"), r.get("visitCount"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    if len(unique) < len(reviews):
        report["warnings"].append(f"같은 리뷰가 두 번 들어 있어 {len(reviews) - len(unique)}개를 뺐어요.")
    reviews = unique

    dates = [r.get("visitedDate") or r.get("createdDate") for r in reviews]
    dates = [d for d in dates if d]
    if any(a < b for a, b in zip(dates, dates[1:])):
        report["warnings"].append("리뷰가 최신순이 아닌 것 같아요. Octoparse 에서 '최신순'으로 다시 수집했는지 확인해 주세요.")
    return reviews


# ---------------------------------------------------------------------------
# 검사와 저장


def validate(place: dict[str, Any]) -> list[str]:
    """types/index.ts 의 CollectedPlace 형식과 맞는지 확인. 문제 목록을 돌려준다."""
    errs: list[str] = []
    s = place.get("store", {})
    for key in ("placeId", "name", "category", "industry"):
        if not isinstance(s.get(key), str):
            errs.append(f"store.{key} 가 문자열이 아니에요")
    if s.get("industry") not in INDUSTRIES:
        errs.append(f"store.industry 는 {INDUSTRIES} 중 하나여야 해요")
    for key in ("tabs", "amenities", "representativeKeywords", "coupons"):
        if not isinstance(s.get(key), list):
            errs.append(f"store.{key} 가 목록이 아니에요")
    for key in ("visitorReviewCount", "blogReviewCount", "ownerPhotoCount", "keywordParticipants"):
        if key in s and not isinstance(s[key], int):
            errs.append(f"store.{key} 가 정수가 아니에요")
    for key in ("hasBookingTab", "hasNaverPay", "hasPlacePlus"):
        if key in s and not isinstance(s[key], bool):
            errs.append(f"store.{key} 가 참/거짓이 아니에요")
    for k in place.get("keywordStats", []):
        if not (isinstance(k.get("keyword"), str) and isinstance(k.get("count"), int)
                and isinstance(k.get("ratio"), (int, float))):
            errs.append(f"keywordStats 항목 형식이 달라요: {k}")
    for i, r in enumerate(place.get("reviews", [])):
        if not isinstance(r.get("body"), str) or not isinstance(r.get("votedKeywords"), list):
            errs.append(f"reviews[{i}] 에 body 또는 votedKeywords 가 없어요")
        if r.get("authType") not in (None, "영수증", "예약", "기타"):
            errs.append(f"reviews[{i}].authType 값이 달라요")
        if r.get("source") not in SOURCES:
            errs.append(f"reviews[{i}].source 값이 달라요")
    if place.get("source") not in SOURCES:
        errs.append("source 값이 달라요")
    if not isinstance(place.get("collectedAt"), str):
        errs.append("collectedAt 이 없어요")
    return errs


def build_place(store_raw: dict[str, Any], review_rows: list[dict[str, Any]] | None, *,
                industry: str | None = None, place_id: str | None = None, participants: int | None = None,
                source: str | None = None, collected_at: str | None = None,
                store_map: dict[str, str] | None = None, review_map: dict[str, str] | None = None,
                report: dict[str, list[str]] | None = None) -> dict[str, Any]:
    report = report if report is not None else {}
    for k in ("warnings", "unknown", "blocked", "review_unknown"):
        report.setdefault(k, [])

    if isinstance(store_raw.get("store"), dict) and "keywordStats" in store_raw:
        # 이미 CollectedPlace 형식인 파일 (예: data/places/*.json) → 리뷰만 바꿔 끼운다
        store = dict(store_raw["store"])
        if industry:
            store["industry"] = industry
        if participants is not None:
            store["keywordParticipants"] = participants
        stats = store_raw.get("keywordStats", [])
        if store.get("keywordParticipants"):
            stats = [{**k, "ratio": round(k["count"] / store["keywordParticipants"], 4)} for k in stats]
        found_at = store_raw.get("collectedAt")
        old_reviews = store_raw.get("reviews", [])
        src = source or store_raw.get("source") or "manual"
    else:
        store, stats, found_at = convert_store(store_raw, industry=industry, place_id=place_id,
                                               participants=participants, extra_map=store_map, report=report)
        old_reviews = []
        src = source or "crawler"

    at = collected_at or found_at or dt.datetime.now(KST).isoformat(timespec="seconds")
    if review_rows is not None:
        rep = {"warnings": report["warnings"], "unknown": report["review_unknown"], "blocked": report["blocked"]}
        reviews = convert_reviews(review_rows, ref=_ref_date(at), extra_map=review_map, report=rep,
                                  place_id=store.get("placeId"))
    else:
        reviews = old_reviews

    place = {"store": store, "keywordStats": stats, "reviews": reviews, "collectedAt": at, "source": src}
    errs = validate(place)
    if errs:
        raise ConvertError("변환 결과가 CollectedPlace 형식과 맞지 않아요:\n  - " + "\n  - ".join(errs))
    return place


def parse_map(items: list[str] | None) -> dict[str, str]:
    out = {}
    for item in items or []:
        if "=" not in item:
            raise ConvertError(f'--map 은 "원래열이름=필드" 형식이어야 해요: {item}')
        src, dst = item.split("=", 1)
        out[src.strip()] = dst.strip()
    return out


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="수집기 JSON + Octoparse 리뷰 → CollectedPlace JSON")
    p.add_argument("--store", required=True, help="수집기 결과 JSON (또는 이미 변환한 data/places/*.json)")
    p.add_argument("--reviews", help="Octoparse 리뷰 파일 (.xlsx 또는 .csv)")
    p.add_argument("--out", help="저장할 파일 (기본: data/places/<placeId>.json)")
    p.add_argument("--industry", choices=INDUSTRIES, help="대상 업종 (자동으로 못 정할 때)")
    p.add_argument("--place-id", help="가게 번호 (수집 결과에 없을 때)")
    p.add_argument("--participants", type=int, help="'이런 점이 좋았어요' 참여 인원 (수집 결과에 없을 때)")
    p.add_argument("--source", choices=SOURCES, help="스냅샷 출처 (기본: crawler)")
    p.add_argument("--collected-at", help="수집 시각 ISO 8601 (기본: 수집 결과 값 또는 지금)")
    p.add_argument("--map", action="append", help='리뷰 열 이름 연결. 예: --map "Text1=body"')
    p.add_argument("--store-map", action="append", help='가게 정보 키 연결. 예: --store-map "title=name"')
    p.add_argument("--force", action="store_true", help="같은 파일이 있으면 덮어쓰기")
    p.add_argument("--dry-run", action="store_true", help="저장하지 않고 결과 요약만 보기")
    a = p.parse_args(argv)

    report: dict[str, list[str]] = {}
    try:
        store_path = Path(a.store)
        if not store_path.exists():
            raise ConvertError(f"파일이 없어요: {store_path}")
        store_raw = json.loads(store_path.read_text(encoding="utf-8-sig"))
        if isinstance(store_raw, list):
            if len(store_raw) != 1:
                raise ConvertError("수집 결과 JSON 에 가게가 여러 개 있어요. 가게 하나씩 나눠서 넣어 주세요.")
            store_raw = store_raw[0]
        rows = read_table(Path(a.reviews)) if a.reviews else None
        place = build_place(store_raw, rows, industry=a.industry, place_id=a.place_id, participants=a.participants,
                            source=a.source, collected_at=a.collected_at, store_map=parse_map(a.store_map),
                            review_map=parse_map(a.map), report=report)
        out = Path(a.out) if a.out else Path("data") / "places" / f"{place['store']['placeId']}.json"
        if not a.dry_run:
            if out.exists() and not a.force and out.resolve() != store_path.resolve():
                raise ConvertError(f"{out} 이(가) 이미 있어요. 덮어쓰려면 --force 를 붙여 주세요.")
            if out.exists() and out.resolve() == store_path.resolve() and not a.force:
                raise ConvertError("입력 파일을 그대로 덮어쓰게 돼요. 맞다면 --force 를 붙여 주세요.")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(place, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except ConvertError as e:
        print(f"[오류] {e}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"[오류] JSON 파일을 읽지 못했어요: {e}", file=sys.stderr)
        return 1

    s = place["store"]
    print(f"가게: {s['name']} ({s['industry']}, placeId {s['placeId']})")
    print(f"키워드 {len(place['keywordStats'])}개, 리뷰 {len(place['reviews'])}개, 수집 시각 {place['collectedAt']}")
    missing = [k for k in OPTIONAL_STORE_FIELDS if k not in s]
    if missing:
        print(f"확인 전(값 없음): {', '.join(missing)}")
    if report.get("blocked"):
        print(f"개인정보라 저장하지 않은 열: {', '.join(report['blocked'])}")
    if report.get("review_unknown"):
        print(f"모르는 리뷰 열(저장 안 함, 필요하면 --map 으로 연결): {', '.join(report['review_unknown'])}")
    if report.get("unknown"):
        print(f"모르는 가게 정보 키(저장 안 함, 필요하면 --store-map 으로 연결): {', '.join(report['unknown'])}")
    for w in report.get("warnings", []):
        print(f"[주의] {w}")
    print("저장 안 함 (--dry-run)" if a.dry_run else f"저장: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
