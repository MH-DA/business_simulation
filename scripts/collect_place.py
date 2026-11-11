"""네이버 플레이스 가게 정보 수집기 → CollectedPlace JSON

가게 링크(지도 링크, naver.me 공유 링크, 가게 번호)를 받아 공개된 가게 정보를 모으고
웹이 바로 읽는 data/places/<가게번호>.json 으로 저장한다. 리뷰 원문은 모으지 않는다(Octoparse 담당).

지키는 원칙 (프로젝트 지침 2·4장)
- 공개 정보만, 한 가게씩 천천히. 봇 확인(자동입력 방지) 화면이 뜨면 우회하지 않고 멈춘다.
- 리뷰 작성자 같은 개인정보는 저장하지 않는다. 화면 원본(data/raw)에도 작성자 정보는 지우고 남긴다.
- 찾지 못한 값은 "없음"으로 짐작하지 않고 비워 둔다 → 화면에 "확인 전".
- 키워드 비율의 분모는 "이런 점이 좋았어요" 참여 인원이다.

준비 (처음 한 번, PowerShell)
  pip install -r scripts\\requirements.txt
  python -m playwright install chromium

사용 예
  python scripts\\collect_place.py                       (링크를 하나씩 붙여 넣는 방식. VS Code ▶ 버튼도 이것)
  python scripts\\collect_place.py "https://map.naver.com/p/entry/place/1500041605?..."
  python scripts\\collect_place.py 1500041605 1618293502 --industry 스터디카페
  python scripts\\collect_place.py --file 가게목록.txt
  python scripts\\collect_place.py 1500041605 --show       (브라우저 창을 띄워서 보기)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import random
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))
import convert_place as cp  # noqa: E402  (값 정리·업종 분류·형식 검사를 같이 쓴다)

ROOT = Path(__file__).resolve().parent.parent
MOBILE = "https://m.place.naver.com/place/{id}/home"
PAGES = ("home", "information", "review/visitor", "feed", "photo")
BLOCK_WORDS = ("자동입력 방지", "자동 입력 방지", "보안 확인", "비정상적인 접근", "captcha", "Captcha", "CAPTCHA")

# 화면 원본을 남길 때 지우는 개인정보 키
PERSONAL_KEYS = {"author", "authorName", "nickname", "nickName", "profileImageUrl", "userIdno", "userId",
                 "writer", "writerName", "authorId", "followerCount", "reviewCount", "imageCount"}
PERSONAL_ENTITY_PREFIX = ("VisitorReview:", "FsasReview:", "Author", "User", "Reviewer")


class BlockedError(Exception):
    """봇 확인 화면이 떴다 → 전체 수집을 멈춘다"""


# ---------------------------------------------------------------------------
# 링크 → 가게 번호


def place_id_of(text: str) -> str | None:
    s = text.strip()
    if re.fullmatch(r"\d{5,}", s):
        return s
    m = re.search(r"/place/(\d{5,})", s) or re.search(r"/(?:restaurant|cafe|hairshop|hospital|accommodation|place)/(\d{5,})", s)
    if m:
        return m.group(1)
    return cp.place_id_from_url(s)


# ---------------------------------------------------------------------------
# Apollo 상태(페이지에 들어 있는 JSON)에서 값 찾기


def walk(obj: Any) -> Iterator[dict[str, Any]]:
    """중첩된 dict/list 안의 모든 dict 를 순서대로"""
    stack = [obj]
    while stack:
        cur = stack.pop(0)
        if isinstance(cur, dict):
            yield cur
            stack.extend(cur.values())
        elif isinstance(cur, list):
            stack.extend(cur)


def entities(state: dict[str, Any], prefix: str) -> list[dict[str, Any]]:
    return [v for k, v in state.items() if k.startswith(prefix) and isinstance(v, dict)]


def first_key(state: Any, names: tuple[str, ...], kind: type | tuple[type, ...] | None = None) -> Any:
    for node in walk(state):
        for n in names:
            v = node.get(n)
            if v is None or v == "" or v == []:
                continue
            if kind is None or isinstance(v, kind):
                return v
    return None


def str_list(v: Any) -> list[str]:
    out: list[str] = []
    for item in v if isinstance(v, list) else []:
        if isinstance(item, dict):
            item = item.get("name") or item.get("displayName") or item.get("title") or item.get("text")
        if isinstance(item, str) and item.strip() and item.strip() not in out:
            out.append(item.strip())
    return out


def scrub(state: Any) -> Any:
    """화면 원본 저장용: 리뷰 작성자 정보 제거"""
    if isinstance(state, dict):
        return {k: scrub(v) for k, v in state.items()
                if k not in PERSONAL_KEYS and not k.startswith(PERSONAL_ENTITY_PREFIX)}
    if isinstance(state, list):
        return [scrub(v) for v in state]
    return state


def num_in(text: str, pattern: str) -> int | None:
    m = re.search(pattern, text)
    return int(m.group(1).replace(",", "")) if m else None


SNS_PATTERNS = {
    "instagramUrl": re.compile(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]+)/?(?=$|[?\"'\s])"),
    "blogUrl": re.compile(r"https?://(?:m\.)?blog\.naver\.com/([A-Za-z0-9_\-]+)/?(?=$|[?\"'\s])"),
}


def find_sns(texts: list[str]) -> dict[str, str]:
    """가게가 등록한 인스타그램·블로그 주소. 리뷰 글 주소(뒤에 글 번호가 붙음)는 제외한다."""
    out: dict[str, str] = {}
    for key, pat in SNS_PATTERNS.items():
        for t in texts:
            for m in pat.finditer(t):
                handle = m.group(1)
                if key == "instagramUrl" and handle in ("p", "reel", "explore", "accounts"):
                    continue
                if key == "blogUrl" and handle in ("PostView.naver", "PostList.naver"):
                    continue
                out[key] = m.group(0).split("?")[0].rstrip("/")
                break
            if key in out:
                break
    return out


DAY_LINE = re.compile(r"^(월|화|수|목|금|토|일|매일|평일|주말|공휴일)(?:요일)?\s*(?:\(\d{1,2}/\d{1,2}\))?$")
TIME_RANGE = re.compile(r"\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}")
SIDO = ("서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남",
        "전북", "전남", "경북", "경남", "제주")


def lines_of(text: str) -> list[str]:
    return [ln.strip() for ln in (text or "").split("\n") if ln.strip()]


def section_after(text: str, heading: str, limit: int = 10) -> list[str]:
    """화면 글자에서 제목 줄 바로 아래 몇 줄 (다음 제목처럼 보이는 줄에서 멈춤)"""
    ls = lines_of(text)
    stops = {"소개", "편의시설 및 서비스", "편의", "찾아오는길", "영업시간", "주소", "전화번호", "홈페이지",
             "대표 키워드", "메뉴", "가격", "쿠폰", "소식", "리뷰", "사진", "정보", "주변"}
    for i, ln in enumerate(ls):
        if ln == heading:
            out = []
            for x in ls[i + 1:i + 1 + limit]:
                if x in stops:
                    break
                out.append(x)
            if out:
                return out
    return []


def hours_from_text(text: str) -> dict[str, str]:
    """펼친 영업시간 화면 글자: '월(11/10)' ↵ '11:00 - 21:00' ↵ '20:30 라스트오더' → {'월': '11:00 - 21:00 / 20:30 라스트오더'}"""
    ls, out = lines_of(text), {}
    for i, ln in enumerate(ls):
        m = DAY_LINE.match(ln)
        if not m or m.group(1) in out:
            continue
        vals = []
        for x in ls[i + 1:i + 5]:
            if DAY_LINE.match(x):
                break
            if TIME_RANGE.search(x) or any(w in x for w in ("휴무", "브레이크", "라스트오더")):
                vals.append(x)
            else:
                break
        if vals:
            out[m.group(1)] = " / ".join(vals)
    return out


def latest_news_date(text: str, ref: dt.date) -> str | None:
    """새소식 탭 글자의 날짜 표시 중 가장 최근 것. 날짜 모양이 분명한 것만 쓴다(별점 4.85 같은 숫자 제외).
    '3일 전', '어제' 같은 표시는 수집일 기준으로 코드가 날짜를 계산한다."""
    found: list[str] = []
    for m in re.finditer(r"\d{4}\.\s?\d{1,2}\.\s?\d{1,2}|(?<![\d.])\d{1,2}\.\d{1,2}\.\s?[월화수목금토일]", text or ""):
        d = cp.parse_date(m.group(0), ref)
        if d:
            found.append(d)
    days = {"분": 0, "시간": 0, "일": 1, "주": 7}
    for m in re.finditer(r"(\d+)\s*(분|시간|일|주)\s*전", text or ""):
        found.append((ref - dt.timedelta(days=int(m.group(1)) * days[m.group(2)])).isoformat())
    if "어제" in (text or ""):
        found.append((ref - dt.timedelta(days=1)).isoformat())
    found = [d for d in found if d <= ref.isoformat()]
    return max(found) if found else None


def format_hours(state: dict[str, Any]) -> tuple[str | None, str | None]:
    """영업시간·휴무일. 요일별 {day, businessHours:{start,end}} 형태를 찾아 글로 만든다."""
    seen: list[str] = []
    closed: list[str] = []
    for node in walk(state):
        day = node.get("day")
        if not isinstance(day, str):
            continue
        bh = node.get("businessHours") if isinstance(node.get("businessHours"), dict) else node
        start, end = bh.get("start"), bh.get("end")
        desc = node.get("description") if isinstance(node.get("description"), str) else ""
        if "휴무" in desc or "휴무" in day:
            closed.append(f"{day} {desc}".strip())
        elif isinstance(start, str) and isinstance(end, str):
            line = f"{day} {start}~{end}"
            if line not in seen:
                seen.append(line)
    hours = ", ".join(seen) or None
    return hours, (", ".join(dict.fromkeys(closed)) or None)


def keyword_stats(state: dict[str, Any], review_text: str) -> tuple[list[dict[str, Any]], int | None, str]:
    """'이런 점이 좋았어요' 키워드 목록과 참여 인원. (목록, 참여 인원, 참여 인원을 어디서 찾았는지)"""
    stats: list[dict[str, Any]] = []
    participants = None
    source = "못 찾음"
    voted = first_key(state, ("votedKeyword",), dict)
    if voted:
        for d in voted.get("details") or []:
            if isinstance(d, dict) and d.get("displayName") and isinstance(d.get("count"), int):
                stats.append({"keyword": d["displayName"], "count": d["count"]})
        if isinstance(voted.get("userCount"), int) and voted["userCount"] > 0:
            participants, source = voted["userCount"], "votedKeyword.userCount"
    if not stats:  # 화면 글자에서 찾기: "집중하기 좋아요"이 키워드를 선택한 인원450
        for m in re.finditer(r"[\"“]([^\"”\n]{2,40})[\"”]\s*이\s*키워드를\s*선택한\s*인원\s*([\d,]+)", review_text):
            stats.append({"keyword": m.group(1), "count": int(m.group(2).replace(",", ""))})
    if participants is None:
        n = num_in(review_text, r"([\d,]+)\s*명(?:이)?\s*참여") or num_in(review_text, r"참여(?:자|인원)?\s*([\d,]+)\s*명")
        if n:
            participants, source = n, "화면 글자(…명 참여)"
    return stats, participants, source


def extract(pages: dict[str, dict[str, Any]], ref: dt.date) -> tuple[dict[str, Any], dict[str, str]]:
    """페이지별 {state, text, tabs, links} → (convert_place 가 읽는 원본 dict, 항목별 출처 메모)"""
    home = pages.get("home", {})
    hs: dict[str, Any] = home.get("state") or {}
    htext: str = home.get("text") or ""
    info = pages.get("information", {})
    istate: dict[str, Any] = info.get("state") or {}
    itext: str = info.get("text") or ""
    both = {**hs, **istate}  # 홈과 정보 탭의 내부 데이터를 같이 본다
    review = pages.get("review/visitor", {})
    feed = pages.get("feed", {})
    photo = pages.get("photo", {})
    all_state = {k: v for p in pages.values() for k, v in (p.get("state") or {}).items()}

    base = next(iter(entities(hs, "PlaceDetailBase:")), None) or next(
        (n for n in walk(hs) if "visitorReviewsTotal" in n or "roadAddress" in n), {})
    raw: dict[str, Any] = {}
    note: dict[str, str] = {}

    def put(key: str, value: Any, where: str) -> None:
        if value is None or value == "" or value == []:
            return
        raw[key] = value
        note[key] = where

    put("name", base.get("name"), "PlaceDetailBase")
    put("category", base.get("category"), "PlaceDetailBase")
    put("address", base.get("roadAddress") or base.get("address"), "PlaceDetailBase")
    if "address" not in raw:
        sec = section_after(itext, "주소", 2)
        line = sec[0] if sec else next((ln for ln in lines_of(htext) if ln.startswith(SIDO)
                                         and re.search(r"(로|길)\s*\d", ln) and len(ln) <= 80), None)
        put("address", line, "화면 글자")
    score = base.get("visitorReviewsScore")
    put("rating", score if isinstance(score, (int, float)) and score > 0 else None, "PlaceDetailBase")
    put("visitorReviewCount", base.get("visitorReviewsTotal"), "PlaceDetailBase")
    if "visitorReviewCount" not in raw:
        put("visitorReviewCount", num_in(htext, r"방문자\s*리뷰\s*([\d,]+)"), "화면 글자")
    blog = next((e.get("total") for e in entities(all_state, "FsasReviewsResult") if isinstance(e.get("total"), int)), None)
    if blog is None:
        blog = next((base[k] for k in ("fsasReviewsTotal", "blogCafeReviewsTotal") if isinstance(base.get(k), int)), None)
    put("blogReviewCount", blog, "FsasReviewsResult.total")
    if "blogReviewCount" not in raw:
        put("blogReviewCount", num_in(htext, r"블로그\s*리뷰\s*([\d,]+)"), "화면 글자")
    put("photoUrl", base.get("imageUrl") or first_key(base, ("imageUrl",), str), "PlaceDetailBase")

    desc = next((n["description"] for n in walk(both)
                 if isinstance(n.get("description"), str) and len(n["description"]) >= 10
                 and ("conveniences" in n or "PlaceDetail" in str(n.get("__typename", "")))), None)
    put("intro", desc, "placeDetail.description")
    put("amenities", str_list(first_key(both, ("conveniences",), list)), "conveniences")
    put("representativeKeywords", str_list(first_key(both, ("keywordList", "representativeKeywords"), list)), "keywordList")
    if "representativeKeywords" not in raw:  # 정보 탭 화면: '대표 키워드' 아래 줄 또는 #해시태그
        kws = section_after(itext, "대표 키워드") or re.findall(r"#([^\s#,]{1,20})", itext)
        put("representativeKeywords", list(dict.fromkeys(k.lstrip("#") for k in kws))[:10], "정보 탭 글자")

    hours, closed = format_hours(both)
    put("openHours", hours, "businessHours")
    put("closedDays", closed, "businessHours")
    if "openHours" not in raw:  # 홈에서 펼친 영업시간 화면 글자
        by_day = hours_from_text(htext + "\n" + itext)
        put("openHours", ", ".join(f"{d} {v}" for d, v in by_day.items() if "휴무" not in v), "화면 글자(영업시간)")
        put("closedDays", ", ".join(f"{d} {v}" for d, v in by_day.items() if "휴무" in v), "화면 글자(영업시간)")
    if "closedDays" not in raw:
        m = re.search(r"(매주\s*\S+\s*정기\s*휴무|매일\s*영업|연중\s*무휴|\S+요일\s*정기\s*휴무)", htext)
        put("closedDays", m.group(1) if m else None, "화면 글자")

    tabs = [t for t in (home.get("tabs") or []) if t]
    put("tabs", tabs, "화면 탭")

    # 쿠폰은 유무만 본다: 쿠폰 탭·내부 쿠폰 데이터·'쿠폰 받기' 중 하나라도 있으면 있음.
    # 탭 목록을 읽었는데 셋 다 없으면 없음, 탭 목록을 못 읽었으면 확인 전.
    coupons = str_list(first_key(all_state, ("coupons", "couponList"), list))
    put("coupons", coupons, "coupons")
    if any("쿠폰" in t for t in tabs) or coupons or "쿠폰 받기" in htext:
        raw["hasCoupon"], note["hasCoupon"] = True, "쿠폰 탭 / coupons"
    elif tabs:
        raw["hasCoupon"], note["hasCoupon"] = False, "탭 목록에 쿠폰 없음"

    npay = first_key(all_state, ("naverPay", "isNaverPay", "hasNaverPay", "npay"), bool)
    if npay is None:
        pay_info = first_key(all_state, ("paymentInfo", "payments", "paymentMethods"), list)
        if pay_info and "네이버페이" in json.dumps(pay_info, ensure_ascii=False):
            npay = True
    if npay is None and ("네이버페이" in htext or "네이버페이" in itext):
        npay = True
    if npay is not None:
        put("hasNaverPay", "있음" if npay else "없음", "naverPay / 화면 글자")
    plus = first_key(all_state, ("isPlacePlus", "placePlus", "hasPlacePlus"), bool)
    if plus is not None:
        put("hasPlacePlus", "있음" if plus else "없음", "placePlus")

    feed_dates = [n.get(k) for n in walk(feed.get("state") or {})
                  for k in ("createdString", "createdAt", "regDate", "date") if isinstance(n.get(k), str)]
    news = next((d for d in (cp.parse_date(x, ref) for x in feed_dates) if d), None)
    if news is None and feed.get("text"):  # 날짜 모양이 분명한 것만: 2026.11.3 / 11.3.월 / 3일 전
        news = latest_news_date(feed["text"], ref)
    put("lastNewsDate", news, "새소식 탭")

    owner_photos = first_key(photo.get("state") or {}, ("businessPhotoCount", "ownerPhotoCount"), int)
    if owner_photos is None:
        owner_photos = num_in(photo.get("text") or "", r"업체\s*([\d,]+)")
    put("ownerPhotoCount", owner_photos, "사진 탭")

    texts = [json.dumps(both, ensure_ascii=False), htext, itext, *(home.get("links") or []), *(info.get("links") or [])]
    for k, v in find_sns(texts).items():
        put(k, v, "가게 정보 링크")

    stats, participants, src = keyword_stats(review.get("state") or {}, review.get("text") or "")
    put("keywordStats", stats, "votedKeyword / 화면 글자")
    put("keywordParticipants", participants, src)
    return raw, note


# ---------------------------------------------------------------------------
# 브라우저로 페이지 열기


def fetch_pages(page: Any, place_id: str, pause: tuple[float, float]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    prefix = None
    for name in PAGES:
        url = MOBILE.format(id=place_id) if name == "home" else f"{prefix}/{name}"
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2500)
        if name == "home":
            expand_hours(page)
        text = page.evaluate("() => document.body ? document.body.innerText : ''")
        hit = next((w for w in BLOCK_WORDS if w in text), None)
        if hit:
            # 진짜 봇 확인인지 사람이 확인할 수 있게 그 화면만 남긴다 (우회는 하지 않는다)
            folder = ROOT / "data" / "raw" / place_id
            folder.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(folder / "blocked.png"), full_page=True)
            (folder / "blocked_text.txt").write_text(text[:5000], encoding="utf-8")
            raise BlockedError(
                f"봇 확인으로 보이는 화면이 떴어요 ({url}, 발견한 단어: '{hit}'). 우회하지 않고 멈출게요.\n"
                f"       그 화면을 data\\raw\\{place_id}\\blocked.png 와 blocked_text.txt 로 남겼어요.")
        state = page.evaluate("() => window.__APOLLO_STATE__ || null")
        data: dict[str, Any] = {"url": page.url, "state": state, "text": text}
        if name == "home":
            prefix = re.sub(r"/home(?:[/?#].*)?$", "", page.url.split("?")[0])
            data["tabs"] = page.evaluate(
                "() => Array.from(document.querySelectorAll('[role=tablist] a, a[role=tab]'))"
                ".map(a => a.innerText.trim()).filter(Boolean)")
        if name in ("home", "information"):
            data["links"] = page.evaluate("() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href)")
        out[name] = data
        time.sleep(random.uniform(*pause))
    return out


def expand_hours(page: Any) -> None:
    """홈 화면에 접혀 있는 영업시간을 한 번 눌러 펼친다. 실패하거나 다른 화면으로 넘어가면 그냥 넘어감"""
    before = page.url
    try:
        page.get_by_text(re.compile(r"영업\s?(중|종료|전)|휴무|브레이크\s?타임")).first.click(timeout=2500)
        page.wait_for_timeout(1000)
    except Exception:
        return
    if page.url != before:
        try:
            page.go_back(wait_until="domcontentloaded", timeout=10000)
            page.wait_for_timeout(1000)
        except Exception:
            pass


def resolve_short_links(page: Any, link: str) -> str:
    """naver.me 같은 짧은 링크는 브라우저로 열어 진짜 주소를 얻는다"""
    if place_id_of(link):
        return link
    page.goto(link, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2000)
    return page.url


def save_raw(place_id: str, pages: dict[str, dict[str, Any]], raw: dict[str, Any], note: dict[str, str]) -> Path:
    folder = ROOT / "data" / "raw" / place_id
    folder.mkdir(parents=True, exist_ok=True)
    for name, p in pages.items():
        slug = name.replace("/", "_")
        (folder / f"{slug}_state.json").write_text(
            json.dumps(scrub(p.get("state")), ensure_ascii=False, indent=1), encoding="utf-8")
        if name != "review/visitor":  # 리뷰 탭 글자에는 작성자·리뷰 원문이 섞여 있어 저장하지 않는다
            (folder / f"{slug}_text.txt").write_text(p.get("text") or "", encoding="utf-8")
    (folder / "found.json").write_text(json.dumps({"raw": raw, "출처": note}, ensure_ascii=False, indent=1),
                                        encoding="utf-8")
    return folder


# ---------------------------------------------------------------------------


LABELS = {
    "name": "이름", "category": "업종", "address": "주소", "openHours": "영업시간", "closedDays": "휴무일",
    "rating": "별점", "visitorReviewCount": "방문자 리뷰 수", "blogReviewCount": "블로그 리뷰 수",
    "intro": "소개글", "amenities": "편의시설", "representativeKeywords": "대표 키워드", "photoUrl": "대표 사진",
    "tabs": "탭 목록", "hasCoupon": "쿠폰 유무", "hasNaverPay": "네이버페이", "hasPlacePlus": "플레이스 플러스",
    "lastNewsDate": "최근 새소식", "ownerPhotoCount": "업체 사진 수", "instagramUrl": "인스타그램",
    "blogUrl": "블로그", "keywordStats": "키워드 통계", "keywordParticipants": "참여 인원",
}


def report(raw: dict[str, Any]) -> str:
    ok = [LABELS[k] for k in LABELS if k in raw]
    miss = [LABELS[k] for k in LABELS if k not in raw]
    return f"  찾음 {len(ok)}개: {', '.join(ok)}\n  확인 전 {len(miss)}개: {', '.join(miss) or '없음'}"


def collect_one(page: Any, link: str, a: argparse.Namespace) -> bool:
    link = resolve_short_links(page, link)
    pid = place_id_of(link)
    if not pid:
        print(f"[건너뜀] 가게 번호를 찾지 못했어요: {link}")
        return False
    now = dt.datetime.now(cp.KST)
    pages = fetch_pages(page, pid, (a.pause, a.pause + 2))
    raw, note = extract(pages, now.date())
    raw["placeId"] = pid
    raw["collectedAt"] = now.isoformat(timespec="seconds")
    if not a.no_raw:
        save_raw(pid, pages, raw, note)

    print(f"\n[{pid}] {raw.get('name', '(이름 못 찾음)')} / {raw.get('category', '-')}")
    print(report(raw))

    stats = raw.pop("keywordStats", None)
    participants = raw.get("keywordParticipants")
    if stats and not participants:
        print("  [주의] 참여 인원을 못 찾아 키워드 통계는 저장하지 않았어요 (비율을 계산할 수 없어서).")
        stats = None
    if stats:
        raw["keywordStats"] = stats

    out = Path(a.out_dir) / f"{pid}.json"
    old_reviews = []
    if out.exists():
        try:
            old_reviews = json.loads(out.read_text(encoding="utf-8")).get("reviews", [])
        except (json.JSONDecodeError, OSError):
            pass
    rep: dict[str, list[str]] = {}
    try:
        place = cp.build_place(raw, None, industry=a.industry, source="crawler", report=rep)
    except cp.ConvertError as e:
        print(f"  [저장 안 함] {e}")
        return False
    place["reviews"] = old_reviews  # 이미 합쳐 둔 Octoparse 리뷰는 지키기
    for w in rep.get("warnings", []):
        print(f"  [주의] {w}")
    if a.dry_run:
        print("  저장 안 함 (--dry-run)")
    else:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(place, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        kept = f", 기존 리뷰 {len(old_reviews)}개 유지" if old_reviews else ""
        print(f"  저장: {out} (업종 {place['store']['industry']}{kept})")
    return True


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="네이버 플레이스 가게 정보 수집 → data/places/<가게번호>.json")
    p.add_argument("links", nargs="*", help="가게 링크, naver.me 공유 링크 또는 가게 번호")
    p.add_argument("--file", help="한 줄에 링크 하나씩 적은 텍스트 파일")
    p.add_argument("--industry", choices=cp.INDUSTRIES, help="업종을 자동으로 못 정할 때 (예: '장소대여'로 나오는 스터디카페)")
    p.add_argument("--out-dir", default=str(ROOT / "data" / "places"))
    p.add_argument("--pause", type=float, default=3.0, help="페이지 사이 쉬는 시간(초, 기본 3~5초)")
    p.add_argument("--show", action="store_true", help="브라우저 창을 띄워서 수집")
    p.add_argument("--no-raw", action="store_true", help="화면 원본(data/raw)을 저장하지 않기")
    p.add_argument("--dry-run", action="store_true", help="저장하지 않고 결과만 보기")
    a = p.parse_args(argv)

    links = list(a.links)
    if a.file:
        links += [ln.strip() for ln in Path(a.file).read_text(encoding="utf-8-sig").splitlines()
                  if ln.strip() and not ln.startswith("#")]
    if not links:  # VS Code ▶ 버튼처럼 링크 없이 실행하면 하나씩 붙여 넣기
        print("가게 링크를 한 줄에 하나씩 붙여 넣으세요. 다 넣었으면 빈 줄에서 Enter를 누르세요.")
        while True:
            try:
                ln = input("링크 > ").strip().strip('"').strip("'")
            except (EOFError, KeyboardInterrupt):
                break
            if not ln:
                break
            links.append(ln)
    if not links:
        p.error("가게 링크를 하나 이상 넣어 주세요.")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[오류] playwright 가 없어요. pip install -r scripts\\requirements.txt 와 "
              "python -m playwright install chromium 을 먼저 실행해 주세요.", file=sys.stderr)
        return 1

    done = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not a.show)
        ctx = browser.new_context(locale="ko-KR", viewport={"width": 430, "height": 900}, is_mobile=True,
                                  user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                                              "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"))
        page = ctx.new_page()
        try:
            for i, link in enumerate(links):
                if i:
                    time.sleep(random.uniform(a.pause + 2, a.pause + 5))
                try:
                    done += collect_one(page, link, a)
                except BlockedError as e:
                    print(f"\n[멈춤] {e}")
                    break
                except Exception as e:  # 한 가게가 실패해도 다음 가게는 계속
                    print(f"\n[실패] {link}: {type(e).__name__}: {e}")
        finally:
            browser.close()
    print(f"\n완료: {done}/{len(links)}곳 저장")
    if not a.no_raw:
        print("화면 원본은 data\\raw\\<가게번호>\\ 에 있어요. '확인 전' 항목이 많으면 이 폴더를 보내 주세요 (깃에는 안 올라가요).")
    return 0 if done else 1


if __name__ == "__main__":
    raise SystemExit(main())
