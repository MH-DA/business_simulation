"""수집기 테스트 (네이버에 접속하지 않고, 가짜 페이지 데이터로 값 찾기만 확인)
실행: python -m unittest scripts/test_collect_place.py -v
"""

import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import collect_place as col  # noqa: E402
import convert_place as cp  # noqa: E402

REF = dt.date(2026, 11, 9)

HOME_STATE = {
    "PlaceDetailBase:1500041605": {
        "__typename": "PlaceDetailBase", "id": "1500041605", "name": "테스트 카페", "category": "카페,디저트",
        "roadAddress": "서울 광진구 능동로 (가짜)", "visitorReviewsScore": 4.61, "visitorReviewsTotal": 812,
        "imageUrl": "https://example.com/a.jpg",
    },
    "ROOT_QUERY": {
        "placeDetail": {
            "__typename": "PlaceDetail", "description": "직접 구운 디저트와 커피가 있는 동네 카페예요.",
            "conveniences": ["주차", "무선 인터넷"], "keywordList": ["건대카페", "디저트"],
            "newBusinessHours": [{"businessHours": [
                {"day": "월", "businessHours": {"start": "10:00", "end": "22:00"}},
                {"day": "화", "businessHours": {"start": "10:00", "end": "22:00"}},
                {"day": "수", "description": "정기휴무"},
            ]}],
            "homepages": {"etc": [{"url": "https://www.instagram.com/test_cafe/"}]},
        }
    },
    "FsasReviewsResult:1": {"total": 95},
    "FsasReview:abc": {"authorName": "블로거닉네임", "url": "https://blog.naver.com/someone/223000000000"},
}

REVIEW_STATE = {
    "VisitorReviewStatsResult:1500041605": {
        "analysis": {"votedKeyword": {"userCount": 300, "details": [
            {"displayName": "커피가 맛있어요", "count": 180},
            {"displayName": "디저트가 맛있어요", "count": 120},
        ]}}
    },
    "VisitorReview:x1": {"author": {"nickname": "리뷰어"}, "body": "맛있어요"},
}


def pages(**over):
    base = {
        "home": {"state": HOME_STATE, "text": "방문자 리뷰 812 블로그 리뷰 95 네이버페이", "tabs": ["홈", "소식", "예약", "리뷰"],
                 "links": ["https://blog.naver.com/test_cafe_official"]},
        "review/visitor": {"state": REVIEW_STATE, "text": ""},
        "feed": {"state": {}, "text": "새소식 11.3.월 이번 주 신메뉴"},
        "photo": {"state": {}, "text": "전체 120 업체 34 방문자 86"},
    }
    base.update(over)
    return base


class Extract(unittest.TestCase):
    def test_all_fields_from_state(self):
        raw, note = col.extract(pages(), REF)
        self.assertEqual(raw["name"], "테스트 카페")
        self.assertEqual(raw["rating"], 4.61)
        self.assertEqual(raw["visitorReviewCount"], 812)
        self.assertEqual(raw["blogReviewCount"], 95)
        self.assertEqual(raw["intro"], "직접 구운 디저트와 커피가 있는 동네 카페예요.")
        self.assertEqual(raw["amenities"], ["주차", "무선 인터넷"])
        self.assertEqual(raw["representativeKeywords"], ["건대카페", "디저트"])
        self.assertEqual(raw["openHours"], "월 10:00~22:00, 화 10:00~22:00")
        self.assertEqual(raw["closedDays"], "수 정기휴무")
        self.assertEqual(raw["hasNaverPay"], "있음")
        self.assertNotIn("hasPlacePlus", raw)  # 못 찾으면 확인 전
        self.assertEqual(raw["lastNewsDate"], "2026-11-03")
        self.assertEqual(raw["ownerPhotoCount"], 34)
        self.assertEqual(raw["instagramUrl"], "https://www.instagram.com/test_cafe")
        self.assertEqual(raw["blogUrl"], "https://blog.naver.com/test_cafe_official")  # 리뷰 글 주소는 제외
        self.assertEqual(raw["keywordParticipants"], 300)
        self.assertEqual(note["keywordParticipants"], "votedKeyword.userCount")
        self.assertEqual(len(raw["keywordStats"]), 2)

    def test_text_fallbacks(self):
        p = pages(**{
            "home": {"state": {}, "text": "방문자 리뷰 1,234 블로그 리뷰 56 매주 월요일 정기휴무", "tabs": []},
            "review/visitor": {"state": {}, "text": '"집중하기 좋아요"이 키워드를 선택한 인원450 "가성비가 좋아요"이 키워드를 선택한 인원414 520명 참여'},
            "feed": {"state": {}, "text": "별점 4.85 소식이 없어요"},
        })
        raw, note = col.extract(p, REF)
        self.assertEqual(raw["visitorReviewCount"], 1234)
        self.assertEqual(raw["blogReviewCount"], 56)
        self.assertEqual(raw["closedDays"], "매주 월요일 정기휴무")
        self.assertEqual(raw["keywordStats"][0], {"keyword": "집중하기 좋아요", "count": 450})
        self.assertEqual(raw["keywordParticipants"], 520)
        self.assertNotIn("lastNewsDate", raw)  # 4.85 를 날짜로 착각하지 않음
        self.assertNotIn("hasNaverPay", raw)

    def test_builds_valid_collected_place(self):
        raw, _ = col.extract(pages(), REF)
        raw.update(placeId="1500041605", collectedAt="2026-11-09T19:00:00+09:00")
        place = cp.build_place(raw, None, source="crawler")
        self.assertEqual(cp.validate(place), [])
        s = place["store"]
        self.assertEqual(s["industry"], "카페")
        self.assertTrue(s["hasBookingTab"])
        self.assertTrue(s["hasNaverPay"])
        self.assertNotIn("hasPlacePlus", s)
        self.assertEqual(place["keywordStats"][0], {"keyword": "커피가 맛있어요", "count": 180, "ratio": 0.6})


class Privacy(unittest.TestCase):
    def test_scrub_removes_authors(self):
        cleaned = str(col.scrub({**HOME_STATE, **REVIEW_STATE}))
        for secret in ("블로거닉네임", "리뷰어"):
            self.assertNotIn(secret, cleaned)
        self.assertIn("테스트 카페", cleaned)
        self.assertIn("votedKeyword", cleaned)


class Links(unittest.TestCase):
    def test_place_id(self):
        url = ("https://map.naver.com/p/entry/place/1500041605?lng=127.0804214&lat=37.5577188"
               "&placePath=%2Fhome&entry=plt&searchType=place&c=15.00,0,0,0,dh")
        self.assertEqual(col.place_id_of(url), "1500041605")
        self.assertEqual(col.place_id_of("1500041605"), "1500041605")
        self.assertEqual(col.place_id_of("https://m.place.naver.com/restaurant/1234567/home"), "1234567")
        self.assertIsNone(col.place_id_of("https://naver.me/FdCLCNV0"))


if __name__ == "__main__":
    unittest.main()
