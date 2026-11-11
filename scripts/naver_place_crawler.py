r"""
네이버 플레이스 정보 수집기 v7.1 — PLACEMENT 기본 정보 수집용

[VS Code 준비] (최초 1회, 저장소 폴더에서)
  pip install playwright openpyxl
  python -m playwright install chromium

[실행] (PowerShell, 저장소 폴더에서)
  python scripts\naver_place_crawler.py
  → 그룹명 입력 → URL 붙여넣기 → 빈 줄 입력 시 종료
  ※ 이전에 실행 중인 프로그램이 있으면 먼저 빈 줄(Enter)로 종료하고 다시 실행하세요.

[입력 가능한 URL 예]
  https://naver.me/xxxxxxx
  https://map.naver.com/p/entry/place/1234567890
  https://map.naver.com/p/search/.../place/1234567890?...
  https://m.place.naver.com/place/1234567890/home

[수집 방식] 오류가 나도 가능한 정보는 최대한 가져오도록 2단계로 동작
  1단계(정적): 브라우저 없이 페이지를 받아 내부 데이터·텍스트에서 추출 — 항상 실행
  2단계(브라우저): 크롬/엣지로 탭을 하나씩 눌러 추가 정보 수집 — 실패해도 1단계 결과는 저장

[결과]  저장소의 data/raw/place_results/<그룹명>/  (data/raw/는 .gitignore 대상 — 깃에 올라가지 않음)
  naver_place_results.xlsx   전체 매장 결과 (요약 / 선택키워드 / 확보여부 시트)
  <place_id>/result.json, report.md, reviews.json, apollo_state.json(개인정보 제거본)

[다음 단계] 웹에서 쓰려면 변환기로 CollectedPlace 형식으로 바꿈
  python scripts\convert_place.py --store data\raw\place_results\<그룹명>\<place_id>\result.json

[v7.1 변경]
  - "이런 점이 좋았어요" 참여 인원 수집 (키워드 비율의 분모)
  - 쿠폰은 내용 대신 유무만 확인 (쿠폰 유무: 있음 / 없음 / 확인 전)

[v7 변경]
  - 추가 항목: 주소, 영업시간, 휴무일, 대표 키워드, 네이버페이, 최근 새소식 날짜, 인스타그램·블로그 링크
  - 개인정보: 내부 데이터 저장 전 작성자·프로필 정보 삭제, 화면 글자(tab_*.txt)는 기본 저장 안 함
  - 못 찾은 값은 '없음'이 아니라 '확인 전'으로 표시
  - 봇 확인 화면이 보이면 그 가게 수집을 멈춤(우회하지 않음)
  - 엑셀에 넣을 수 없는 특수문자 때문에 저장이 멈추던 문제 수정

주의: 학습 목적의 소규모 조사용. 매장 수 적게, 대기시간 유지.
      리뷰 작성자 닉네임 등 개인정보는 수집·저장하지 않음.
"""
import json
import re
import time
import traceback
import urllib.request
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.parse import unquote

HEADLESS = False        # 처음엔 False: 브라우저 동작을 눈으로 확인
DELAY = 2.0             # 동작 사이 대기(초)
MAX_REVIEWS = 100       # 매장당 수집할 방문자 리뷰 최대 개수 (최신순)
ROOT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw" / "place_results"   # 깃에 안 올라가는 폴더
OUT_DIR = ROOT_DIR   # 실행 시 입력한 그룹 이름에 따라 place_results/<그룹명> 으로 바뀜
EXCEL_NAME = "naver_place_results.xlsx"
SAVE_RAW_TEXT = False   # True면 탭별 화면 글자(tab_*.txt) 저장 — 리뷰 작성자 이름이 섞일 수 있어 확인용으로만 잠깐 켜세요

MOBILE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
             "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")

PLACE_ID_RE = re.compile(
    r"/(?:place|restaurant|cafe|hairshop|hospital|accommodation|nailshop)/(\d{5,})")
EXTRA_ID_RES = [re.compile(r"[?&](?:placeId|pinId|id)=(\d{5,})")]
BASE_RE = re.compile(r"(https://m\.place\.naver\.com/[a-z]+/\d+)")

# 수집에 필요 없는 탭은 건너뜀
SKIP_TABS = {"홈", "지도", "주변"}
# 탭 링크를 못 읽었을 때 쓰는 기본 경로
TAB_PATHS = {"소식": "feed", "예약": "booking", "리뷰": "review/visitor",
             "사진": "photo", "정보": "information", "메뉴": "menu/list", "가격": "price"}

PLACE_PLUS_SIGNALS = ["인기 메뉴", "평균 결제", "체류", "붐비", "인기 급상승", "신상 핫플"]

# 봇 확인·접근 제한 화면에 나오는 문구 — 보이면 그 가게는 멈춤(우회하지 않음)
BLOCK_SIGNALS = ["자동입력 방지", "자동 입력 방지", "보안 절차", "captcha", "비정상적인 접근",
                 "일시적으로 제한", "로봇이 아닙니다"]

# 저장 전 지울 개인정보 키 / 통째로 지울 내부 데이터 종류
PRIVATE_KEYS = {"author", "nickname", "nickName", "userName", "userId", "userIdno", "writer",
                "profileImageUrl", "profileImage", "profileUrl", "followerCount", "followers",
                "reviewer", "userInfo"}
PRIVATE_PREFIXES = ("VisitorReview:", "FsasReview", "Author", "User", "Ugc", "BlogReview", "CafeReview")

DAYS = ["월", "화", "수", "목", "금", "토", "일"]
DAY_RE = re.compile(r"^(월|화|수|목|금|토|일|매일|평일|주말|공휴일)(?:요일)?\s*(?:\(\d{1,2}/\d{1,2}\))?$")
TIME_RE = re.compile(r"\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}")
SIDO = ("서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
        "충북", "충남", "충청", "전북", "전남", "전라", "전북특별자치도", "경북", "경남", "경상", "제주")
INSTA_RE = re.compile(r"https?://(?:www\.)?instagram\.com/[A-Za-z0-9_.]+/?")
BLOG_RE = re.compile(r"https?://(?:m\.)?blog\.naver\.com/[A-Za-z0-9_\-]+(?:/\d+)?/?")

SEP = "=====구분====="  # 여러 페이지 텍스트를 이어 붙일 때 경계 표시

# 섹션 발췌 시 멈출 제목 ('주차', '예약'은 편의시설 항목 이름으로도 쓰여서 제외)
STOP_HEADINGS = {"소개", "편의시설 및 서비스", "편의", "찾아오는길", "영업시간",
                 "가격", "가격표", "메뉴", "쿠폰", "새소식", "소식", "리뷰", "사진", "블로그",
                 "주변", "정보", "홈페이지", "전화번호", "주소", "이런 점이 좋았어요", SEP}

REPORT_ITEMS = ["업체명", "업종", "주소", "영업시간", "휴무일", "별점", "방문자 리뷰 수", "블로그 리뷰 수",
                "수집 리뷰 수", "영수증 인증(수집분)", "대표 키워드", "예약 탭", "네이버페이",
                "플레이스 플러스 흔적", "최근 새소식 날짜", "인스타그램", "블로그",
                "선택 키워드 통계", "참여 인원", "업체 사진 수", "소개글", "편의시설 및 서비스", "쿠폰 유무"]


# ================================================================ 헬퍼
def lines_of(text):
    return [l.strip() for l in (text or "").split("\n") if l.strip()]


def to_int(s):
    try:
        return int(str(s).replace(",", ""))
    except (TypeError, ValueError):
        return None


def find_first(text, pattern):
    m = re.search(pattern, text or "")
    return m.group(1) if m else None


def section_after(text, heading, max_lines=20):
    ls = lines_of(text)
    for i, l in enumerate(ls):
        if l == heading:
            out = []
            for x in ls[i + 1:i + 1 + max_lines]:
                if x in STOP_HEADINGS:
                    break
                out.append(x)
            if out:
                return out
    return []


def deep_find(obj, key, found=None):
    if found is None:
        found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key:
                found.append(v)
            deep_find(v, key, found)
    elif isinstance(obj, list):
        for v in obj:
            deep_find(v, key, found)
    return found


def first_str(values):
    for v in values:
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def looks_blocked(text):
    t = (text or "").lower()
    return any(s.lower() in t for s in BLOCK_SIGNALS)


def scrub(obj):
    """저장 전 개인정보 제거: 작성자·프로필 키 삭제, 리뷰·작성자 객체는 통째로 삭제"""
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items()
                if k not in PRIVATE_KEYS and not str(k).startswith(PRIVATE_PREFIXES)}
    if isinstance(obj, list):
        return [scrub(v) for v in obj]
    return obj


def iter_dicts(obj):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from iter_dicts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_dicts(v)


def guard(fn, default=None):
    """항목 하나가 실패해도 나머지는 계속 수집"""
    try:
        return fn()
    except Exception:
        return default


# ================================================================ 1단계: 정적 수집
def http_get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": MOBILE_UA, "Accept-Language": "ko-KR,ko;q=0.9"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.geturl(), resp.read().decode("utf-8", errors="ignore")


def html_to_text(html):
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</(div|p|li|span|a|h\d|button|strong|em)>", "\n", html)
    text = unescape(re.sub(r"<[^>]+>", "", html))
    return "\n".join(lines_of(text))


def parse_apollo(html):
    i = html.find("__APOLLO_STATE__")
    if i == -1:
        return {}
    j = html.find("{", i)
    try:
        obj, _ = json.JSONDecoder().raw_decode(html[j:])
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def resolve_place_id(url):
    """입력 URL → place ID. naver.me 단축링크는 리다이렉트를 따라가서 찾음"""
    for s in (url, unquote(url)):
        m = PLACE_ID_RE.search(s)
        if m:
            return m.group(1)
    try:
        final, body = http_get(url)
        for s in (final, unquote(final), body[:300000]):
            m = PLACE_ID_RE.search(s)
            if m:
                return m.group(1)
            for r in EXTRA_ID_RES:
                m = r.search(s)
                if m:
                    return m.group(1)
    except Exception as e:
        print(f"  - 링크 확인 실패: {e}")
    return None


def static_collect(place_id):
    texts, apollo, base, blocked = {}, {}, None, False
    for tab in ["home", "information", "review/visitor", "photo", "feed"]:
        try:
            final, html = http_get(f"https://m.place.naver.com/place/{place_id}/{tab}")
            text = html_to_text(html)
            if looks_blocked(text):
                print("  - (정적) 봇 확인 화면이 나와서 정적 수집을 멈춰요. (우회하지 않음)")
                blocked = True
                break
            m = BASE_RE.search(final)
            if m and not base:
                base = m.group(1)
            texts[tab] = text
            apollo.update(parse_apollo(html))
        except Exception as e:
            print(f"  - (정적) {tab} 실패: {e}")
        time.sleep(1)
    return {"texts": texts, "apollo": apollo, "base": base, "blocked": blocked}


# ================================================================ 2단계: 브라우저 수집
LAUNCH_OPTIONS = [
    ("Chromium(창 표시)", {"headless": HEADLESS}),
    ("Chromium(백그라운드)", {"headless": True}),
    ("Edge", {"channel": "msedge", "headless": True}),
    ("Chrome", {"channel": "chrome", "headless": True}),
]


def safe_text(page):
    try:
        return page.inner_text("body")
    except Exception:
        return ""


def get_apollo(page):
    try:
        return page.evaluate("() => window.__APOLLO_STATE__ || null") or {}
    except Exception:
        return {}



# ================================================================ 리뷰 수집 (v6)
# 개인정보 보호: 작성자 닉네임·프로필·사진 파일/주소는 저장하지 않음. 사진은 '장수'만 기록.
def _resolve(v, apollo):
    if isinstance(v, dict) and "__ref" in v and isinstance(apollo, dict):
        return apollo.get(v["__ref"], {})
    return v


def _norm_review(o, apollo):
    body = o.get("body")
    if not isinstance(body, str):
        return None
    kws = []
    for k in (o.get("votedKeywords") or []):
        k = _resolve(k, apollo)
        if isinstance(k, dict):
            name = k.get("displayName") or k.get("name") or k.get("code")
            if name:
                kws.append(str(name))
        elif isinstance(k, str):
            kws.append(k)
    media = o.get("media") or o.get("images") or o.get("photos") or []
    reply = _resolve(o.get("reply"), apollo)
    reply_body = reply.get("body") if isinstance(reply, dict) else None
    auth = o.get("originType") or o.get("authType")
    if not auth:
        if o.get("receiptInfoUrl") or o.get("receiptInfo"):
            auth = "영수증"
        elif o.get("bookingItemName") or o.get("bookingInfo"):
            auth = "예약"
    return {
        "방문일": o.get("visited"),
        "작성일": o.get("created"),
        "방문 횟수": to_int(o.get("visitCount")),
        "인증 유형": auth,
        "선택 키워드": kws,
        "사진 수": len(media) if isinstance(media, list) else None,
        "답글 여부": bool(reply_body),
        "답글": reply_body,
        "본문": body.strip(),
    }


def harvest_reviews(obj, found, apollo=None):
    """JSON 어디에 있든 '본문 + 날짜/방문횟수'를 가진 객체를 리뷰로 모음"""
    if isinstance(obj, dict):
        if "body" in obj and any(k in obj for k in ("visited", "created", "visitCount")):
            rv = _norm_review(obj, apollo)
            if rv and rv["본문"]:
                rid = obj.get("id") or f"{rv['방문일']}|{rv['본문'][:40]}"
                found.setdefault(str(rid), rv)
        for v in obj.values():
            harvest_reviews(v, found, apollo)
    elif isinstance(obj, list):
        for v in obj:
            harvest_reviews(v, found, apollo)


DATE_RE = re.compile(r"(\d{2,4}\.\d{1,2}\.\d{1,2}\.?\s*[월화수목금토일]?|\d{1,2}\.\d{1,2}\.[월화수목금토일])")
VISIT_RE = re.compile(r"(\d+)\s*번째\s*방문")
META_WORDS = ("영수증", "예약", "결제", "번째 방문", "방문일", "리뷰", "사진", "팔로우", "팔로워",
              "반응 남기기", "더보기", "펼쳐보기", "접기", "인증 수단", "재방문")


def parse_review_text(text, known_kws):
    """화면에 보이는 리뷰 한 개의 텍스트를 항목별로 분리 (네트워크 데이터가 없을 때 사용)
    작성자 닉네임은 저장하지 않도록 본문은 '가장 긴 문장 줄'만 사용"""
    ls = lines_of(text)
    visit = VISIT_RE.search(text)
    date = DATE_RE.search(text)
    auth = next((w for w in ("영수증", "예약", "결제") if any(l == w or l.startswith(w) for l in ls)), None)
    kws = [l for l in ls if l in known_kws]
    cand = [l for l in ls if l not in known_kws and len(l) >= 10
            and not DATE_RE.fullmatch(l) and not any(l.startswith(w) for w in META_WORDS)]
    body = max(cand, key=len) if cand else None
    if not body:
        return None
    return {"방문일": date.group(1) if date else None, "작성일": None,
            "방문 횟수": to_int(visit.group(1)) if visit else None, "인증 유형": auth,
            "선택 키워드": kws, "사진 수": None, "답글 여부": None, "답글": None, "본문": body}


DOM_JS = r"""() => Array.from(document.querySelectorAll('li'))
  .map(li => li.innerText || '')
  .filter(t => t.length > 20 && (t.includes('번째 방문') || t.includes('방문일') || /\d{1,2}\.\d{1,2}\.[월화수목금토일]/.test(t)))"""


def collect_reviews(page, responses, known_kws=(), limit=MAX_REVIEWS):
    net, dom, cursor, stale = {}, {}, 0, 0
    debug = []
    known = set(known_kws)
    try:   # 시계열 분석을 위해 최신순 정렬 시도
        page.get_by_text("최신순", exact=True).first.click(timeout=2500)
        time.sleep(DELAY)
    except Exception:
        pass

    def harvest():
        nonlocal cursor
        new = responses[cursor:]
        cursor = len(responses)
        for resp in new:
            info = {"url": resp.url[:160]}
            try:
                if "json" in (resp.headers.get("content-type") or ""):
                    data = resp.json()
                    info["json"] = True
                    info["has_body_key"] = '"body"' in json.dumps(data, ensure_ascii=False)[:500000]
                    harvest_reviews(data, net)
            except Exception as e:
                info["error"] = str(e)[:80]
            if "graphql" in resp.url or info.get("json"):
                debug.append(info)
        ap = get_apollo(page)
        harvest_reviews(ap, net, ap)
        # 화면(DOM) 기준 수집 — 네트워크에서 못 잡을 때의 대안
        try:
            for t in page.evaluate(DOM_JS):
                rv = parse_review_text(t, known)
                if rv:
                    dom.setdefault(f"{rv['방문일']}|{rv['본문'][:40]}", rv)
        except Exception:
            pass

    harvest()
    for _ in range(60):
        if max(len(net), len(dom)) >= limit:
            break
        before = max(len(net), len(dom))
        try:
            more = page.locator("a:has-text('더보기'), button:has-text('더보기')").last
            more.scroll_into_view_if_needed(timeout=2000)
            more.click(timeout=3000)
        except Exception:
            page.mouse.wheel(0, 6000)
        time.sleep(1.5)
        harvest()
        stale = stale + 1 if max(len(net), len(dom)) == before else 0
        if stale >= 3:
            break

    if len(net) >= len(dom):
        reviews, how = list(net.values())[:limit], "내부 데이터"
    else:
        reviews, how = list(dom.values())[:limit], "화면 텍스트"
    print(f"  - 리뷰 {len(reviews)}개 수집 (목표 {limit}개, 방식: {how} / 내부 {len(net)}·화면 {len(dom)})")
    return reviews, debug

def browser_collect(place_id):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  - playwright 미설치 → 브라우저 단계 건너뜀 (pip install playwright)")
        return None

    with sync_playwright() as p:
        for label, opts in LAUNCH_OPTIONS:
            browser = None
            try:   # 브라우저 '실행' 실패만 다음 브라우저로 넘어감
                browser = p.chromium.launch(**opts)
            except Exception as e:
                print(f"  - 브라우저 실행 실패({label}): {str(e).splitlines()[0][:100]}")
                continue
            try:   # 접속 이후 실패는 같은 가게에 다시 접속하지 않고 멈춤
                context = browser.new_context(viewport={"width": 420, "height": 900},
                                              user_agent=MOBILE_UA, locale="ko-KR")
                page = context.new_page()
                page.goto(f"https://m.place.naver.com/place/{place_id}/home",
                          wait_until="domcontentloaded", timeout=30000)
                time.sleep(DELAY)
                if looks_blocked(safe_text(page)):
                    print("  - 봇 확인 화면이 나와서 브라우저 수집을 멈춰요. (우회하지 않음)")
                    return {"blocked": True}
                print(f"  - 브라우저 실행 성공: {label}")
                return _browse(page)
            except Exception as e:
                print(f"  - 브라우저 수집 실패({label}): {str(e).splitlines()[0][:100]}")
                return None
            finally:
                if browser:
                    try:
                        browser.close()
                    except Exception:
                        pass
    return None


LINK_JS = "() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href)"


def page_links(page):
    try:
        return page.evaluate(LINK_JS) or []
    except Exception:
        return []


def expand_hours(page):
    """홈 화면의 접힌 영업시간을 펼쳐봄 (실패해도 그냥 넘어감)"""
    before = page.url
    try:
        page.get_by_text(re.compile(r"영업\s?(중|종료|전)|휴무|브레이크\s?타임")).first.click(timeout=2500)
        time.sleep(1)
    except Exception:
        return
    if page.url != before:   # 다른 화면으로 넘어갔으면 되돌아옴
        try:
            page.go_back(wait_until="domcontentloaded", timeout=10000)
            time.sleep(1)
        except Exception:
            pass


def _browse(page):
    expand_hours(page)
    res = {"texts": {"홈": safe_text(page)}, "apollo": get_apollo(page),
           "base": None, "tabs": [], "photo_img_count": None, "title": guard(page.title),
           "reviews": [], "info_links": [], "blocked": False}
    responses = []
    page.on("response", lambda resp: responses.append(resp))
    m = BASE_RE.search(page.url)
    res["base"] = m.group(1) if m else None

    # 홈 화면 탭 바에서 (탭 이름, 링크) 목록을 읽어둔 뒤, 클릭 대신 링크로 직접 이동
    # (클릭 방식은 탭 이동 후 탭 바가 다시 그려지면서 타임아웃이 나는 문제가 있었음)
    tab_links = []
    try:
        tab_links = page.eval_on_selector_all(
            "[role='tablist'] a",
            "els => els.map(e => [e.innerText.trim(), e.href])")
    except Exception:
        pass
    tab_links = [(n, h) for n, h in tab_links if n]
    if not tab_links:
        try:
            tl = page.locator("[role='tablist']").first
            if tl.count() > 0:
                tab_links = [(n, None) for n in lines_of(tl.inner_text())]
        except Exception:
            pass
    res["tabs"] = [n for n, _ in tab_links]

    for name, href in tab_links:
        if name in SKIP_TABS:
            continue
        url = href or (f"{res['base']}/{TAB_PATHS[name]}" if res["base"] and name in TAB_PATHS else None)
        if not url:
            continue
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(DELAY)
            if looks_blocked(safe_text(page)):
                print(f"  - '{name}' 탭에서 봇 확인 화면이 나와서 남은 탭 수집을 멈춰요. (우회하지 않음)")
                res["blocked"] = True
                break
            if name == "정보":   # 홈페이지·SNS 링크는 '정보' 탭에서만 (홈의 블로그 리뷰 링크가 섞이지 않게)
                res["info_links"] = page_links(page)
            if name == "사진":
                try:
                    page.get_by_text("업체", exact=True).first.click(timeout=3000)
                    time.sleep(1)
                except Exception:
                    pass
                for _ in range(3):
                    page.mouse.wheel(0, 3000)
                    time.sleep(0.8)
                res["photo_img_count"] = page.locator("img").count()
            if name == "리뷰" and MAX_REVIEWS > 0:
                try:
                    known = [d.get("displayName") for v in deep_find(res["apollo"], "details")
                             if isinstance(v, list) for d in v if isinstance(d, dict) and d.get("displayName")]
                    res["reviews"], res["review_debug"] = collect_reviews(page, responses, known)
                except Exception as e:
                    print(f"  - 리뷰 수집 실패: {str(e).splitlines()[0][:80]}")
            res["texts"][name] = safe_text(page)
            res["apollo"].update(get_apollo(page))
            print(f"  - '{name}' 탭 수집 완료")
        except Exception as e:
            print(f"  - '{name}' 탭 이동 실패: {str(e).splitlines()[0][:80]}")
    return res


# ================================================================ 항목 추출
def extract(place_id, static, browser):
    r = {"place_id": place_id}
    apollo = dict(static.get("apollo") or {})
    texts = {f"정적_{k}": v for k, v in (static.get("texts") or {}).items()}
    tabs = []
    if browser:
        apollo.update(browser.get("apollo") or {})
        texts.update(browser.get("texts") or {})
        tabs = browser.get("tabs") or []
    blocked = static.get("blocked") or (browser or {}).get("blocked")
    r["수집 방식"] = ("정적+브라우저" if browser else "정적만(브라우저 실패)") + \
        (" / 봇 확인으로 일부 중단" if blocked else "")
    r["base_url"] = (browser or {}).get("base") or static.get("base")

    J = f"\n{SEP}\n"   # 페이지 경계에서 섹션 발췌가 넘어가지 않도록
    all_text = J.join(texts.values())
    home_text = texts.get("홈", "") + J + texts.get("정적_home", "")
    review_text = texts.get("리뷰", "") + J + texts.get("정적_review/visitor", "")
    info_text = texts.get("정보", "") + J + texts.get("정적_information", "") + J + home_text
    photo_text = texts.get("사진", "") + J + texts.get("정적_photo", "")
    only_info = texts.get("정보", "") + J + texts.get("정적_information", "")
    feed_text = texts.get("소식", "") + J + texts.get("정적_feed", "")

    base_obj = next((v for k, v in apollo.items()
                     if k.startswith("PlaceDetailBase") and isinstance(v, dict)), {})

    r["업체명"] = guard(lambda: base_obj.get("name")
                     or ((browser or {}).get("title") or "").split(" : ")[0] or None)
    r["업종"] = guard(lambda: base_obj.get("category") or first_str(deep_find(apollo, "category")))

    def _score():
        s = base_obj.get("visitorReviewsScore") or find_first(all_text, r"별점\s*([\d.]+)")
        return float(s) if s else None
    r["별점"] = guard(_score)

    r["방문자 리뷰 수"] = guard(lambda: to_int(base_obj.get("visitorReviewsTotal"))
                          or to_int(find_first(all_text, r"방문자\s*리뷰\s*([\d,]+)")))
    def _blog():
        for key in ["fsasReviewsTotal", "blogCafeReviewsTotal", "blogReviewsTotal"]:
            v = base_obj.get(key)
            if v is None:
                v = next((x for x in deep_find(apollo, key) if x is not None), None)
            if to_int(v) is not None:
                return to_int(v)
        for k, v in apollo.items():   # FsasReviews… 객체의 total
            if k.startswith("FsasReviews") and isinstance(v, dict) and to_int(v.get("total")) is not None:
                return to_int(v.get("total"))
        return to_int(find_first(all_text, r"블로그\s*리뷰\s*([\d,]+)"))
    r["블로그 리뷰 수"] = guard(_blog)
    # (v6) 페이지 숫자를 잘못 잡던 영수증 정규식 제거 → 수집한 리뷰 기준으로 계산
    reviews = (browser or {}).get("reviews") or []
    n = len(reviews)
    r["수집 리뷰 수"] = n or None
    r["영수증 인증(수집분)"] = (sum(1 for x in reviews if x.get("인증 유형") and "영수증" in str(x["인증 유형"]))
                          if n and any(x.get("인증 유형") for x in reviews) else None)
    pct = lambda k: round(100 * k / n, 1) if n else None
    r["사진 리뷰 비율(%)"] = pct(sum(1 for x in reviews if (x.get("사진 수") or 0) > 0))
    r["답글률(%)"] = pct(sum(1 for x in reviews if x.get("답글 여부")))
    r["재방문 비율(%)"] = pct(sum(1 for x in reviews if (x.get("방문 횟수") or 0) >= 2))

    r["탭 목록"] = tabs
    def _booking():
        if tabs:
            return any("예약" in t for t in tabs)
        keys = ["bookingUrl", "naverBookingUrl", "bookingBusinessId"]
        if any(v for k in keys for v in deep_find(apollo, k)):
            return True
        return None   # 정적 모드에서 판단 불가
    r["예약 탭"] = guard(_booking)

    has_home = bool(texts.get("홈", "").strip() or texts.get("정적_home", "").strip())
    r["플레이스 플러스 흔적"] = guard(lambda: [s for s in PLACE_PLUS_SIGNALS if s in home_text]) if has_home else None

    def _keywords():
        kw = []
        for v in deep_find(apollo, "details"):
            if isinstance(v, list):
                for d in v:
                    if isinstance(d, dict) and "displayName" in d and "count" in d:
                        kw.append({"keyword": d["displayName"], "count": to_int(d["count"])})
        if not kw:
            for m in re.finditer(r'"([^"\n]{2,30})"\s*\n?(?:이 키워드를 선택한 인원\s*\n?)?([\d,]+)',
                                 review_text):
                kw.append({"keyword": m.group(1), "count": to_int(m.group(2))})
        seen, out = set(), []
        for k in kw:
            if k["keyword"] not in seen:
                seen.add(k["keyword"])
                out.append(k)
        return sorted(out, key=lambda x: -(x["count"] or 0))
    r["선택 키워드 통계"] = guard(_keywords, [])

    def _participants():
        """'이런 점이 좋았어요' 참여 인원. 키워드별 선택 인원보다 작으면 잘못 잡은 것으로 보고 비워 둠"""
        top = max([k["count"] or 0 for k in r["선택 키워드 통계"]] or [0])
        cands = []
        for d in iter_dicts(apollo):   # 키워드 목록(details)을 가진 묶음에서 '사람 수' 키를 찾음
            det = d.get("details")
            if isinstance(det, list) and any(isinstance(x, dict) and "displayName" in x for x in det):
                r["_키워드묶음_키목록"] = sorted(k for k in d.keys() if k != "details")
                for key in ("userCount", "participantCount", "usersCount", "totalUserCount", "voterCount"):
                    if to_int(d.get(key)):
                        cands.append(to_int(d.get(key)))
        for pat in (r"([\d,]+)\s*명\s*참여", r"참여(?:자|인원)?\s*([\d,]+)\s*명", r"참여자\s*([\d,]+)"):
            v = to_int(find_first(review_text, pat))
            if v:
                cands.append(v)
        for v in cands:
            if v >= top:
                return v
        if cands:
            print(f"  - 참여 인원 후보({cands[0]})가 키워드 선택 인원({top})보다 작아서 '확인 전'으로 뒀어요.")
        return None
    r["참여 인원"] = guard(_participants)

    r["업체 사진 수"] = guard(lambda: to_int(find_first(photo_text, r"업체\s*(?:사진)?\s*([\d,]+)")))
    r["_사진탭_로드된_img수"] = (browser or {}).get("photo_img_count")

    def _intro():
        sec = " ".join(section_after(texts.get("정보", "") + J + texts.get("정적_information", ""), "소개", 30))
        if sec:
            return sec
        if isinstance(base_obj.get("description"), str) and base_obj["description"].strip():
            return base_obj["description"].strip()
        return None   # (v7) 메뉴 설명 등 다른 글을 소개글로 잘못 가져오던 대체 경로 삭제
    r["소개글"] = guard(_intro)
    r["_소개글_출처"] = "정보 탭" if texts.get("정보") and section_after(texts.get("정보"), "소개") else "내부 데이터/정적"

    def _conv():
        for c in deep_find(apollo, "conveniences"):
            if isinstance(c, list) and c:
                return [x if isinstance(x, str) else json.dumps(x, ensure_ascii=False) for x in c]
        return section_after(info_text, "편의시설 및 서비스") or section_after(info_text, "편의")
    r["편의시설 및 서비스"] = guard(_conv, [])

    def _coupon():
        # '쿠폰' 섹션 제목 아래 내용만 인정 (소식·소개 글 속 '쿠폰' 단어는 제외)
        lines = []
        for src in [texts.get("홈", ""), texts.get("정적_home", ""), texts.get("정보", "")]:
            lines = section_after(src, "쿠폰", 10)
            if lines:
                break
        for k, v in apollo.items():   # 내부 데이터의 쿠폰 객체
            if "Coupon" in k and isinstance(v, dict):
                t = v.get("title") or v.get("name")
                if t:
                    lines.append(str(t))
        return list(dict.fromkeys(lines))[:10]
    coupon_lines = guard(_coupon, []) or []

    def _has_coupon():
        """쿠폰은 유무만: 쿠폰 탭·쿠폰 섹션·내부 쿠폰 데이터 중 하나라도 있으면 있음.
        탭 목록을 읽었는데 셋 다 없으면 없음, 탭 목록을 못 읽었으면 확인 전"""
        if any("쿠폰" in t for t in tabs) or coupon_lines or "쿠폰 받기" in home_text:
            return True
        if tabs:
            return False
        return None
    r["쿠폰 유무"] = guard(_has_coupon)

    # ---------------- (v7) 추가 항목
    def _address():
        for key in ("roadAddress", "address", "fullAddress", "commonAddress"):
            v = base_obj.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        sec = section_after(info_text, "주소", 3)
        if sec:
            return sec[0]
        for l in lines_of(home_text):
            if l.startswith(SIDO) and re.search(r"(로|길|동|읍|면|리)\s*\d", l) and len(l) <= 80:
                return l
        return None
    r["주소"] = guard(_address)

    hours = guard(lambda: hours_from_apollo(apollo) or hours_from_text(home_text + J + only_info), {}) or {}
    r["영업시간"] = [f"{d} {v}" for d, v in hours.items()] or None

    def _holiday():
        out = [f"{d} {v}" for d, v in hours.items() if "휴무" in v]
        for l in lines_of(home_text + J + only_info):
            if "휴무" in l and 3 < len(l) <= 50 and l not in STOP_HEADINGS and not looks_blocked(l):
                out.append(l)
        for d in iter_dicts(deep_find(apollo, "newBusinessHours")):
            for key in ("description", "freeText", "comingRegularClosedDays", "regularClosedDays"):
                v = d.get(key)
                if isinstance(v, str) and "휴무" in v:
                    out.append(v.strip())
        uniq = []   # 같은 내용이 요일 붙은 형태로 이미 있으면 빼기
        for x in dict.fromkeys(out):
            if not any(x != y and x in y for y in out):
                uniq.append(x)
        out = uniq
        if out:
            return out
        if all(d in hours for d in DAYS):   # 7일 모두 영업시간이 보이고 휴무 문구가 없을 때만
            return ["표시된 휴무 없음"]
        return None
    r["휴무일"] = guard(_holiday)

    def _rep_keywords():
        for key in ("keywordList", "representKeywords", "keywords"):
            for v in deep_find(apollo, key):
                if isinstance(v, list) and v and all(isinstance(x, str) for x in v):
                    return [x.strip().lstrip("#") for x in v if x.strip()][:10]
        sec = section_after(only_info, "대표 키워드", 10)
        if sec:
            return [x.lstrip("#") for x in sec]
        tags = re.findall(r"#([^\s#,]{1,20})", texts.get("정보", ""))
        return list(dict.fromkeys(tags))[:10] or None
    r["대표 키워드"] = guard(_rep_keywords)

    def _npay():
        for key in ("paymentInfo", "payments", "paymentMethods", "naverPay", "hasNPay", "isNaverPay", "npay"):
            for v in deep_find(apollo, key):
                if v is True:
                    return True
                if v and ("네이버페이" in json.dumps(v, ensure_ascii=False) or "NPAY" in json.dumps(v).upper()):
                    return True
        if "네이버페이" in info_text:
            return True
        return None   # 표시를 못 찾음 → '없음'이 아니라 '확인 전'
    r["네이버페이"] = guard(_npay)

    def _news():
        found = latest_date(feed_text, datetime.now())
        if found:
            return found
        if tabs and not any("소식" in t for t in tabs):
            return {"날짜": None, "표시": "소식 탭 없음"}
        return None
    news = guard(_news)
    r["최근 새소식 날짜"] = (news or {}).get("날짜") or (news or {}).get("표시")
    r["최근 새소식 표시"] = (news or {}).get("표시")

    def _links():
        own = []   # 가게가 등록한 홈페이지 목록(내부 데이터) — 글 링크도 인정
        for h in deep_find(apollo, "homepages"):
            for key in ("url", "landingUrl"):
                own += [u for u in deep_find(h, key) if isinstance(u, str)]
        page = list((browser or {}).get("info_links") or []) + re.findall(r"https?://\S+", only_info)
        urls = own + page
        insta = list(dict.fromkeys(m.group(0).rstrip("/") for u in urls for m in [INSTA_RE.match(u)] if m))
        # 화면에서 찾은 블로그 링크는 '블로그 주소'만 인정 (남의 블로그 글이 섞이지 않게)
        blog = [m.group(0).rstrip("/") for u in own for m in [BLOG_RE.match(u)] if m]
        blog += [m.group(0).rstrip("/") for u in page for m in [BLOG_RE.match(u)]
                 if m and not re.search(r"/\d+/?$", m.group(0))]
        blog = list(dict.fromkeys(blog))
        insta = [u for u in insta if not re.search(r"instagram\.com/(p|reel|explore|accounts)$", u)]
        return insta, blog
    insta, blog = guard(_links, ([], []))
    r["인스타그램"] = insta or None
    r["블로그"] = blog or None
    return r, texts, apollo


def hours_from_apollo(apollo):
    """내부 데이터의 영업시간 → {요일: '11:00 - 21:00 / 브레이크 …'} (구조가 달라 못 읽으면 빈 값)"""
    out = {}
    for d in iter_dicts(deep_find(apollo, "newBusinessHours") + deep_find(apollo, "businessHours")):
        day = d.get("day")
        if not isinstance(day, str):
            continue
        bh = d.get("businessHours") if isinstance(d.get("businessHours"), dict) else d
        start, end = bh.get("start") or bh.get("startTime"), bh.get("end") or bh.get("endTime")
        parts = [f"{start} - {end}"] if start and end else []
        for b in d.get("breakHours") or []:
            if isinstance(b, dict) and b.get("start"):
                parts.append(f"브레이크타임 {b.get('start')} - {b.get('end')}")
        for lo in d.get("lastOrderTimes") or []:
            if isinstance(lo, dict) and lo.get("time"):
                parts.append(f"라스트오더 {lo.get('time')}")
        desc = d.get("description")
        if isinstance(desc, str) and desc.strip():
            parts.append(desc.strip())
        if parts and day not in out:
            out[day] = " / ".join(parts)
    return out


def hours_from_text(text):
    """화면 글자에서 '월 ↵ 11:00 - 21:00' 형태를 찾음"""
    ls, out = lines_of(text), {}
    for i, l in enumerate(ls):
        m = DAY_RE.match(l)
        if not m or m.group(1) in out:
            continue
        vals = []
        for x in ls[i + 1:i + 5]:
            if DAY_RE.match(x) or x in STOP_HEADINGS:
                break
            if TIME_RE.search(x) or any(w in x for w in ("휴무", "브레이크", "라스트오더")):
                vals.append(x)
            else:
                break
        if vals:
            out[m.group(1)] = " / ".join(vals)
    return out


def latest_date(text, now):
    """소식 탭 글자에서 날짜 표시를 모두 찾아 가장 최근 것을 고름 → {'날짜': 'YYYY-MM-DD', '표시': 화면 표시}"""
    from datetime import date, timedelta
    cands = []
    for m in re.finditer(r"(?<!\d)(\d{4}|\d{2})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?", text or ""):
        y = int(m.group(1)) + (2000 if len(m.group(1)) == 2 else 0)
        cands.append((y, int(m.group(2)), int(m.group(3)), m.group(0)))
    for m in re.finditer(r"(?<![\d.])(\d{1,2})\.(\d{1,2})\.\s?[월화수목금토일]", text or ""):
        y = now.year if (int(m.group(1)), int(m.group(2))) <= (now.month, now.day) else now.year - 1
        cands.append((y, int(m.group(1)), int(m.group(2)), m.group(0)))
    found = []
    for y, mo, d, raw in cands:
        try:
            found.append((date(y, mo, d), raw))
        except ValueError:
            pass
    unit = {"분": 0, "시간": 0, "일": 1, "주": 7}
    for m in re.finditer(r"(\d+)\s*(분|시간|일|주)\s*전", text or ""):
        found.append((now.date() - timedelta(days=int(m.group(1)) * unit[m.group(2)]), m.group(0)))
    if "어제" in (text or ""):
        found.append((now.date() - timedelta(days=1), "어제"))
    found = [f for f in found if f[0] <= now.date()]
    if not found:
        return None
    d, raw = max(found, key=lambda x: x[0])
    return {"날짜": d.isoformat(), "표시": raw}


# ================================================================ 저장
def status(v):
    return "?" if v is None or v == [] or v == "" else "O"


def short(v):
    if isinstance(v, list):
        if v and isinstance(v[0], dict):
            return ", ".join(f"{d['keyword']}({d['count']})" for d in v[:5]) + (" …" if len(v) > 5 else "")
        return ", ".join(map(str, v[:6])) + (" …" if len(v) > 6 else "")
    if isinstance(v, bool):
        return "있음" if v else "없음"
    s = str(v)
    return s[:60] + ("…" if len(s) > 60 else "")


def save_place(r, texts, apollo, reviews=None, debug=None):
    out = OUT_DIR / r["place_id"]
    out.mkdir(parents=True, exist_ok=True)
    if debug:
        (out / "review_debug.json").write_text(json.dumps(debug, ensure_ascii=False, indent=2),
                                               encoding="utf-8")
    if reviews is not None:
        (out / "reviews.json").write_text(json.dumps(reviews, ensure_ascii=False, indent=2),
                                          encoding="utf-8")
    if SAVE_RAW_TEXT:   # 확인용. 리뷰 탭 글자는 작성자 이름이 많아서 켜도 저장 안 함
        for k, v in texts.items():
            if "리뷰" in k or "review" in k:
                continue
            (out / f"tab_{k.replace('/', '_')}.txt").write_text(v, encoding="utf-8")
    if apollo:
        (out / "apollo_state.json").write_text(json.dumps(scrub(apollo), ensure_ascii=False, indent=2),
                                               encoding="utf-8")
    (out / "result.json").write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")
    rows = ["| 항목 | 확보 | 값(요약) |", "|---|---|---|"]
    for k in REPORT_ITEMS:
        v = r.get(k)
        rows.append(f"| {k} | {status(v)} | {short(v) if status(v) == 'O' else ''} |")
    rows += ["", f"- 수집 방식: {r.get('수집 방식')}",
             f"- 탭 목록: {', '.join(r.get('탭 목록') or []) or '?'}",
             f"- 사진 탭 로드된 img 수(참고용 하한값): {r.get('_사진탭_로드된_img수', '?')}"]
    (out / "report.md").write_text(f"# {r.get('업체명') or r['place_id']}\n\n" + "\n".join(rows),
                                   encoding="utf-8")


def build_excel():
    """place_results 아래 모든 result.json을 모아 엑셀 1개로 (실행할 때마다 누적)"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
    except ImportError:
        print("  - openpyxl 미설치 → 엑셀 저장 건너뜀 (pip install openpyxl)")
        return

    results = []
    for f in sorted(OUT_DIR.glob("*/result.json")):
        try:
            results.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    if not results:
        return

    wb = Workbook()
    font, bold = Font(name="Arial"), Font(name="Arial", bold=True, color="FFFFFF")
    fill = PatternFill("solid", start_color="1F3864")
    wrap = Alignment(wrap_text=True, vertical="top")

    def write_sheet(ws, headers, rows, widths):
        ws.append(headers)
        for row in rows:   # 엑셀에 넣을 수 없는 제어문자 제거 (저장이 멈추던 문제)
            ws.append([ILLEGAL_CHARACTERS_RE.sub("", v) if isinstance(v, str) else v for v in row])
        for c in ws[1]:
            c.font, c.fill = bold, fill
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.font, c.alignment = font, wrap
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[ws.cell(1, i).column_letter].width = w
        ws.freeze_panes = "B2"

    def cell(v):
        if v is None:
            return "확인 전"
        if isinstance(v, bool):
            return "있음" if v else "없음"
        if isinstance(v, list):
            if v and isinstance(v[0], dict):
                return ", ".join(f"{d['keyword']}({d['count']})" for d in v)
            return ", ".join(map(str, v))
        return v

    ws = wb.active
    ws.title = "요약"
    headers = ["업체명", "place_id", "업종", "주소", "영업시간", "휴무일", "별점", "방문자 리뷰 수",
               "블로그 리뷰 수", "수집 리뷰 수", "영수증 인증(수집분)", "사진 리뷰 비율(%)", "답글률(%)",
               "재방문 비율(%)", "대표 키워드", "예약 탭", "네이버페이", "플레이스 플러스 흔적(참고)",
               "최근 새소식 날짜", "최근 새소식 표시", "인스타그램", "블로그", "업체 사진 수",
               "사진탭 로드 img수(참고)", "선택 키워드 상위5", "참여 인원", "소개글", "편의시설 및 서비스", "쿠폰 유무",
               "탭 목록", "수집 방식", "수집 시각", "입력 URL"]

    def pp(v):
        return "확인 전" if v is None else ("흔적 없음" if v == [] else cell(v))

    def lst(v):   # 빈 목록도 '확인 전' (없다고 단정하지 않음)
        return cell(v) if v else "확인 전"

    rows = []
    for r in results:
        rows.append([r.get("업체명"), r.get("place_id"), cell(r.get("업종")), cell(r.get("주소")),
                     lst(r.get("영업시간")), lst(r.get("휴무일")), cell(r.get("별점")),
                     cell(r.get("방문자 리뷰 수")), cell(r.get("블로그 리뷰 수")),
                     cell(r.get("수집 리뷰 수")), cell(r.get("영수증 인증(수집분)")),
                     cell(r.get("사진 리뷰 비율(%)")), cell(r.get("답글률(%)")), cell(r.get("재방문 비율(%)")),
                     lst(r.get("대표 키워드")), cell(r.get("예약 탭")), cell(r.get("네이버페이")),
                     pp(r.get("플레이스 플러스 흔적")), cell(r.get("최근 새소식 날짜")),
                     cell(r.get("최근 새소식 표시")), lst(r.get("인스타그램")), lst(r.get("블로그")),
                     cell(r.get("업체 사진 수")), r.get("_사진탭_로드된_img수"),
                     lst((r.get("선택 키워드 통계") or [])[:5]), cell(r.get("참여 인원")), cell(r.get("소개글")),
                     lst(r.get("편의시설 및 서비스")), cell(r.get("쿠폰 유무")), lst(r.get("탭 목록")),
                     r.get("수집 방식"), r.get("collected_at"), r.get("input_url")])
    write_sheet(ws, headers, rows,
                [22, 13, 14, 35, 40, 25, 7, 10, 10, 10, 10, 10, 10, 10, 30, 8, 10, 18,
                 12, 12, 35, 35, 10, 10, 45, 10, 50, 35, 10, 30, 22, 20, 40])

    ws_r = wb.create_sheet("리뷰")
    rv_rows = []
    for r in results:
        f = OUT_DIR / str(r.get("place_id")) / "reviews.json"
        if not f.exists():
            continue
        try:
            items = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        for i, x in enumerate(items, start=1):
            rv_rows.append([r.get("업체명"), r.get("place_id"), i, x.get("방문일"), x.get("작성일"),
                            x.get("방문 횟수"), x.get("인증 유형"), ", ".join(x.get("선택 키워드") or []),
                            x.get("사진 수"), "있음" if x.get("답글 여부") else "없음",
                            x.get("답글"), x.get("본문")])
    write_sheet(ws_r, ["업체명", "place_id", "번호", "방문일", "작성일", "방문 횟수", "인증 유형",
                       "선택 키워드", "사진 수", "답글 여부", "답글", "리뷰 본문"],
                rv_rows, [22, 13, 6, 12, 12, 8, 10, 30, 7, 8, 40, 70])

    ws2 = wb.create_sheet("선택키워드")
    kw_rows = []
    for r in results:
        for i, d in enumerate(r.get("선택 키워드 통계") or [], start=1):
            kw_rows.append([r.get("업체명"), r.get("place_id"), i, d.get("keyword"), d.get("count")])
    write_sheet(ws2, ["업체명", "place_id", "순위", "키워드", "선택 인원"], kw_rows, [22, 13, 6, 30, 10])

    ws3 = wb.create_sheet("확보여부")
    write_sheet(ws3, ["매장"] + REPORT_ITEMS,
                [[r.get("업체명") or r.get("place_id")] + [status(r.get(k)) for k in REPORT_ITEMS]
                 for r in results],
                [22] + [12] * len(REPORT_ITEMS))
    ws3.append([])
    ws3.append(["O = 확보됨, ? = 확인 전(이번 수집에서 못 찾음) → apollo_state.json 확인 또는 SAVE_RAW_TEXT=True로 다시 수집"])

    path = OUT_DIR / EXCEL_NAME
    try:
        wb.save(path)
    except PermissionError:   # 엑셀에서 파일을 열어둔 경우
        path = OUT_DIR / f"{Path(EXCEL_NAME).stem}_{datetime.now():%H%M%S}.xlsx"
        wb.save(path)
        print("  - 기존 엑셀 파일이 열려 있어 새 이름으로 저장했어요.")
    print(f"  → 엑셀 저장: {path}")


# ================================================================ 실행
def collect(url):
    url = url.strip().strip('"').strip("'")
    if not url.startswith("http"):
        if "naver" in url:
            url = "https://" + url
        else:
            print("  [건너뜀] 네이버 플레이스 URL이 아니에요. 링크만 붙여넣어 주세요.")
            return None

    place_id = resolve_place_id(url)
    if not place_id:
        print("  [실패] place ID를 찾지 못했어요. 지도에서 가게를 연 뒤 주소창 URL을 넣어보세요.")
        return None
    print(f"  - place_id: {place_id}")

    print("  - 1단계(정적) 수집...")
    static = static_collect(place_id)

    print("  - 2단계(브라우저) 수집...")
    browser = None
    try:
        browser = browser_collect(place_id)
    except Exception as e:
        print(f"  - 브라우저 단계 오류(정적 결과로 계속): {str(e).splitlines()[0][:100]}")

    r, texts, apollo = extract(place_id, static, browser)
    r["input_url"] = url
    r["collected_at"] = datetime.now().isoformat(timespec="seconds")
    save_place(r, texts, apollo, (browser or {}).get("reviews") or [], (browser or {}).get("review_debug"))
    build_excel()
    return r


def print_summary(r):
    print("\n" + "=" * 60)
    print(f"  수집 방식: {r.get('수집 방식')}")
    for k in REPORT_ITEMS:
        v = r.get(k)
        if k == "플레이스 플러스 흔적" and v == []:
            print(f"  [O] {k:<14} 흔적 없음(참고용)")
            continue
        if v is None or v == [] or v == "":
            print(f"  [?] {k:<14} 확인 전")
            continue
        print(f"  [{status(v)}] {k:<14} {short(v) if status(v) == 'O' else ''}")
    if r.get("수집 리뷰 수"):
        print(f"  리뷰 지표: 사진 리뷰 {r.get('사진 리뷰 비율(%)')}% · 답글률 {r.get('답글률(%)')}% · "
              f"재방문 {r.get('재방문 비율(%)')}% (수집분 {r.get('수집 리뷰 수')}개 기준)")
    print(f"  → 상세 파일: {OUT_DIR / r['place_id']}")
    print("=" * 60 + "\n")


def main():
    global OUT_DIR, EXCEL_NAME
    print("이번에 수집할 그룹 이름을 입력하세요. (예: 헬스장, 스터디카페)")
    print("  → place_results/<그룹명> 폴더에 따로 저장되고, 엑셀도 그룹별로 만들어져요.")
    print("  → 그냥 Enter를 누르면 '기본' 그룹으로 저장돼요.")
    try:
        group = input("그룹명 > ").strip()
    except (EOFError, KeyboardInterrupt):
        return
    group = re.sub(r'[\\/:*?"<>|]', "_", group) or "기본"
    OUT_DIR = ROOT_DIR / group
    EXCEL_NAME = f"naver_place_results_{group}.xlsx"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("=" * 60)
    print("  네이버 플레이스 수집기 v7.1")
    print(f"  결과 폴더: {OUT_DIR}")
    print("  URL을 붙여넣으세요. (빈 줄 입력 시 종료)")
    print("  ※ 수집 중에 뜨는 브라우저 창은 닫지 마세요.")
    print("=" * 60)
    while True:
        try:
            url = input("URL > ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not url:
            break
        try:
            r = collect(url)
            if r:
                print_summary(r)
        except Exception:
            print("  [오류] 아래 내용을 복사해서 공유해 주세요.")
            traceback.print_exc()
        time.sleep(DELAY)


if __name__ == "__main__":
    main()