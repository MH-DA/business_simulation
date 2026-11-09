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
PAGES = ("home", "review/visitor", "feed", "photo")
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
    score = base.get("visitorReviewsScore")
    put("rating", score if isinstance(score, (int, float)) and score > 0 else None, "PlaceDetailBase")
    put("visitorReviewCount", base.get("visitorReviewsTotal"), "PlaceDetailBase")
    if "visitorReviewCount" not in raw:
        put("visitorReviewCount", num_in(htext, r"방문자\s*리뷰\s*([\d,]+)"), "화면 글자")
    blog = next((e.get("total") for e in entities(all_state, "FsasReviewsResult") if isinstance(e.get("total"), int)), None)
    put("blogReviewCount", blog, "FsasReviewsResult.total")
    if "blogReviewCount" not in raw:
        put("blogReviewCount", num_in(htext, r"블로그\s*리뷰\s*([\d,]+)"), "화면 글자")
    put("photoUrl", base.get("imageUrl") or first_key(base, ("imageUrl",), str), "PlaceDetailBase")

    desc = next((n["description"] for n in walk(hs)
                 if isinstance(n.get("description"), str) and len(n["description"]) >= 10
                 and ("conveniences" in n or "PlaceDetail" in str(n.get("__typename", "")))), None)
    put("intro", desc, "placeDetail.description")
    put("amenities", str_list(first_key(hs, ("conveniences",), list)), "conveniences")
    put("representativeKeywords", str_list(first_key(hs, ("keywordList", "representativeKeywords"), list)), "keywordList")

    hours, closed = format_hours(hs)
    put("openHours", hours, "businessHours")
    put("closedDays", closed, "businessHours")
    if "closedDays" not in raw:
        m = re.search(r"(매주\s*\S+\s*정기\s*휴무|매일\s*영업|연중\s*무휴|\S+요일\s*정기\s*휴무)", htext)
        put("closedDays", m.group(1) if m else None, "화면 글자")

    tabs = [t for t in (home.get("tabs") or []) if t]
    put("tabs", tabs, "화면 탭")

    coupons = str_list(first_key(all_state, ("coupons", "couponList"), list))
    if not coupons and "쿠폰" in tabs:
        coupons = ["쿠폰"]
    put("coupons", coupons, "coupons / 쿠폰 탭")

    npay = first_key(all_state, ("naverPay", "isNaverPay", "hasNaverPay", "npay"), bool)
    if npay is None and "네이버페이" in htext:
        npay = True
    if npay is not None:
        put("hasNaverPay", "있음" if npay else "없음", "naverPay / 화면 글자")
    plus = first_key(all_state, ("isPlacePlus", "placePlus", "hasPlacePlus"), bool)
    if plus is not None:
        put("hasPlacePlus", "있음" if plus else "없음", "placePlus")

    feed_dates = [n.get(k) for n in walk(feed.get("state") or {})
                  for k in ("createdString", "createdAt", "regDate", "date") if isinstance(n.get(k), str)]
    news = next((d for d in (cp.parse_date(x, ref) for x in feed_dates) if d), None)
    if news is None and feed.get("text"):  # 날짜 모양이 분명한 것만: 2026.11.3 / 11.3.월
        m = re.search(r"\d{4}\.\s?\d{1,2}\.\s?\d{1,2}|\b\d{1,2}\.\d{1,2}\.\s?[월화수목금토일]", feed["text"])
        news = cp.parse_date(m.group(0), ref) if m else None
    put("lastNewsDate", news, "새소식 탭")

    owner_photos = first_key(photo.get("state") or {}, ("businessPhotoCount", "ownerPhotoCount"), int)
    if owner_photos is None:
        owner_photos = num_in(photo.get("text") or "", r"업체\s*([\d,]+)")
    put("ownerPhotoCount", owner_photos, "사진 탭")

    texts = [json.dumps(hs, ensure_ascii=False), htext, *(home.get("links") or [])]
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
        text = page.evaluate("() => document.body ? document.body.innerText : ''")
        if any(w in text for w in BLOCK_WORDS):
            raise BlockedError(f"봇 확인 화면이 떴어요 ({url}). 우회하지 않고 멈출게요. 한참 뒤에 다시 시도해 주세요.")
        state = page.evaluate("() => window.__APOLLO_STATE__ || null")
        data: dict[str, Any] = {"url": page.url, "state": state, "text": text}
        if name == "home":
            prefix = re.sub(r"/home(?:[/?#].*)?$", "", page.url.split("?")[0])
            data["tabs"] = page.evaluate(
                "() => Array.from(document.querySelectorAll('[role=tablist] a, a[role=tab]'))"
                ".map(a => a.innerText.trim()).filter(Boolean)")
            data["links"] = page.evaluate("() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href)")
        out[name] = data
        time.sleep(random.uniform(*pause))
    return out


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
    "tabs": "탭 목록", "coupons": "쿠폰", "hasNaverPay": "네이버페이", "hasPlacePlus": "플레이스 플러스",
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
