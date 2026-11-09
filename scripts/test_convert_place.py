"""변환기 테스트.  실행: python -m unittest scripts/test_convert_place.py -v"""

import datetime as dt
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import convert_place as cp  # noqa: E402

REF = dt.date(2026, 11, 8)

COLLECTOR = {
    "place_id": "1234567",
    "업체명": "테스트 카페",
    "업종": "카페,디저트",
    "주소": "서울 광진구 (가짜 주소)",
    "별점": "4.52",
    "방문자 리뷰 수": "1,234",
    "영업시간": "09:30 ~ 22:00",
    "탭 목록": ["홈", "소식", "예약", "리뷰"],
    "편의시설": "주차, 무선 인터넷",
    "소개글": "동네 카페입니다. 펼쳐보기",
    "네이버페이": "알수없음",
    "참여 인원": 200,
    "이런 점이 좋았어요": [{"keyword": "\"커피가 맛있어요\"", "count": 50}, {"keyword": "인테리어가 멋져요", "count": 120}],
    "수집시각": "2026-11-07T10:00:00+09:00",
    "크롤러버전": "v6.1",
}

ROWS = [
    {"작성자": "홍길동", "링크": "https://x", "팔로워": "12", "본문": "커피 맛있어요 010-1234-5678 로 연락",
     "방문일": "11.5.수", "방문 횟수": "2번째 방문", "인증 수단": "영수증", "사진 수": "3", "사장님 답글": "감사합니다",
     "Field9": "?"},
    {"작성자": "김철수", "링크": "https://y", "팔로워": "", "본문": "조용해요",
     "방문일": "2026.10.30", "방문 횟수": "", "인증 수단": "예약", "사진 수": "", "사장님 답글": "", "Field9": ""},
    {"작성자": "", "링크": "", "팔로워": "", "본문": "", "방문일": "", "방문 횟수": "", "인증 수단": "",
     "사진 수": "", "사장님 답글": "", "Field9": ""},
]


class ValueParsing(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(cp.parse_date("2026.9.20", REF), "2026-09-20")
        self.assertEqual(cp.parse_date("26.9.20.", REF), "2026-09-20")
        self.assertEqual(cp.parse_date("9.20.토", REF), "2026-09-20")
        self.assertEqual(cp.parse_date("12.30.화", REF), "2025-12-30")  # 수집일보다 뒤 → 작년
        self.assertEqual(cp.parse_date("2026년 1월 3일", REF), "2026-01-03")
        self.assertEqual(cp.parse_date(dt.datetime(2026, 2, 1, 9), REF), "2026-02-01")
        self.assertIsNone(cp.parse_date("어제", REF))

    def test_bool_unknown_stays_unknown(self):
        self.assertTrue(cp.to_bool("있음"))
        self.assertFalse(cp.to_bool("X"))
        self.assertIsNone(cp.to_bool("알수없음"))
        self.assertIsNone(cp.to_bool("확인 전"))
        self.assertIsNone(cp.to_bool(None))

    def test_numbers(self):
        self.assertEqual(cp.to_int("방문자 리뷰 1,234"), 1234)
        self.assertIsNone(cp.to_int(""))
        self.assertEqual(cp.to_float("별점 4.52"), 4.52)

    def test_place_id_from_url(self):
        self.assertEqual(cp.place_id_from_url("https://map.naver.com/p/entry/place/1234567?c=1"), "1234567")
        self.assertIsNone(cp.place_id_from_url("https://naver.me/abc"))

    def test_industry(self):
        self.assertEqual(cp.infer_industry("카페,디저트"), "카페")
        self.assertEqual(cp.infer_industry("스터디카페"), "스터디카페")
        self.assertEqual(cp.infer_industry("헬스,피트니스"), "헬스장")
        self.assertEqual(cp.infer_industry("한식"), "음식점")
        self.assertIsNone(cp.infer_industry("장소대여"))


class StoreConversion(unittest.TestCase):
    def test_store_fields(self):
        report = {"warnings": [], "unknown": []}
        store, stats, at = cp.convert_store(COLLECTOR, report=report)
        self.assertEqual(store["placeId"], "1234567")
        self.assertEqual(store["industry"], "카페")
        self.assertEqual(store["visitorReviewCount"], 1234)
        self.assertEqual(store["rating"], 4.52)
        self.assertEqual(store["amenities"], ["주차", "무선 인터넷"])
        self.assertEqual(store["intro"], "동네 카페입니다.")
        self.assertTrue(store["hasBookingTab"])  # 탭 목록에 예약이 있음
        self.assertNotIn("hasNaverPay", store)  # 모르는 값은 확인 전
        self.assertNotIn("blogReviewCount", store)  # 없는 값은 확인 전
        self.assertIn("크롤러버전", report["unknown"])
        self.assertEqual(at, "2026-11-07T10:00:00+09:00")

    def test_ratio_uses_participants(self):
        _, stats, _ = cp.convert_store(COLLECTOR)
        self.assertEqual(stats[0], {"keyword": "인테리어가 멋져요", "count": 120, "ratio": 0.6})
        self.assertEqual(stats[1], {"keyword": "커피가 맛있어요", "count": 50, "ratio": 0.25})

    def test_missing_participants_is_error(self):
        raw = {k: v for k, v in COLLECTOR.items() if k != "참여 인원"}
        with self.assertRaises(cp.ConvertError):
            cp.convert_store(raw)
        report = {"warnings": [], "unknown": []}
        _, stats, _ = cp.convert_store(raw, participants=100, report=report)
        self.assertEqual(stats[1]["ratio"], 0.5)
        self.assertTrue(any("참여 인원" in w for w in report["warnings"]))  # 120 > 100 이면 경고

    def test_unknown_industry_needs_flag(self):
        raw = {**COLLECTOR, "업종": "장소대여"}
        with self.assertRaises(cp.ConvertError):
            cp.convert_store(raw)
        store, _, _ = cp.convert_store(raw, industry="스터디카페")
        self.assertEqual(store["industry"], "스터디카페")

    def test_nested_collector_json(self):
        nested = {"basic": {"id": "7654321", "name": "중첩 헬스장", "category": "헬스장"}, "extra": {"rating": 4.1}}
        store, stats, _ = cp.convert_store(nested)
        self.assertEqual(store["placeId"], "7654321")
        self.assertEqual(store["rating"], 4.1)
        self.assertEqual(stats, [])


class ReviewConversion(unittest.TestCase):
    def setUp(self):
        self.report = {"warnings": [], "unknown": [], "blocked": []}
        self.reviews = cp.convert_reviews(ROWS, ref=REF, report=self.report)

    def test_personal_columns_are_dropped(self):
        self.assertEqual(sorted(self.report["blocked"]), ["링크", "작성자", "팔로워"])
        text = json.dumps(self.reviews, ensure_ascii=False)
        for secret in ("홍길동", "김철수", "https://x"):
            self.assertNotIn(secret, text)
        self.assertIn("Field9", self.report["unknown"])

    def test_fields(self):
        self.assertEqual(len(self.reviews), 2)  # 빈 줄은 건너뜀
        r = self.reviews[0]
        self.assertEqual(r["visitedDate"], "2026-11-05")
        self.assertEqual(r["visitCount"], 2)
        self.assertEqual(r["authType"], "영수증")
        self.assertEqual(r["photoCount"], 3)
        self.assertTrue(r["hasOwnerReply"])
        self.assertEqual(r["source"], "octoparse")
        self.assertIn("[전화번호 삭제]", r["body"])
        self.assertNotIn("010-1234-5678", r["body"])
        r2 = self.reviews[1]
        self.assertFalse(r2["hasOwnerReply"])
        self.assertNotIn("visitCount", r2)
        self.assertEqual(self.report["warnings"], [])  # 최신순이 맞음

    def test_not_latest_first_warns(self):
        report = {"warnings": [], "unknown": [], "blocked": []}
        cp.convert_reviews(list(reversed(ROWS[:2])), ref=REF, report=report)
        self.assertTrue(any("최신순" in w for w in report["warnings"]))

    def test_column_map(self):
        rows = [{"Text1": "좋아요", "Field3": "11.1"}]
        with self.assertRaises(cp.ConvertError):
            cp.convert_reviews(rows, ref=REF)
        reviews = cp.convert_reviews(rows, ref=REF, extra_map={"Text1": "body", "Field3": "방문일"})
        self.assertEqual(reviews[0]["body"], "좋아요")
        self.assertEqual(reviews[0]["visitedDate"], "2026-11-01")

    def test_map_cannot_unblock_author(self):
        rows = [{"본문": "좋아요", "작성자": "홍길동"}]
        reviews = cp.convert_reviews(rows, ref=REF, extra_map={"작성자": "body"})
        self.assertNotIn("홍길동", json.dumps(reviews, ensure_ascii=False))


class Files(unittest.TestCase):
    def run_cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = cp.main(list(args))
        return code, out.getvalue(), err.getvalue()

    def test_csv_without_bom_and_cp949(self):
        with tempfile.TemporaryDirectory() as d:
            for enc in ("utf-8", "cp949"):
                p = Path(d) / f"r-{enc}.csv"
                p.write_text("작성자,본문,방문일\n홍길동,맛있어요,11.1.토\n", encoding=enc)
                rows = cp.read_table(p)
                self.assertEqual(rows[0]["본문"], "맛있어요")

    def test_xlsx_end_to_end(self):
        import openpyxl

        with tempfile.TemporaryDirectory() as d:
            store_path = Path(d) / "store.json"
            store_path.write_text(json.dumps(COLLECTOR, ensure_ascii=False), encoding="utf-8")
            xlsx = Path(d) / "reviews.xlsx"
            wb = openpyxl.Workbook()
            ws = wb.active
            cols = list(ROWS[0].keys())
            ws.append(cols)
            for row in ROWS:
                ws.append([row[c] for c in cols])
            wb.save(xlsx)
            out = Path(d) / "out.json"

            code, stdout, _ = self.run_cli("--store", str(store_path), "--reviews", str(xlsx), "--out", str(out))
            self.assertEqual(code, 0)
            place = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(cp.validate(place), [])
            self.assertEqual(place["source"], "crawler")
            self.assertEqual(len(place["reviews"]), 2)
            self.assertIn("개인정보라 저장하지 않은 열", stdout)
            self.assertIn("확인 전", stdout)

            # 같은 파일이 있으면 --force 없이는 덮어쓰지 않는다
            code, _, err = self.run_cli("--store", str(store_path), "--out", str(out))
            self.assertEqual(code, 1)
            self.assertIn("--force", err)

            # 이미 변환한 파일에 리뷰만 다시 넣기
            code, _, _ = self.run_cli("--store", str(out), "--reviews", str(xlsx), "--out", str(out), "--force")
            self.assertEqual(code, 0)

    def test_sample_files_are_valid(self):
        root = Path(__file__).resolve().parent.parent
        for f in (root / "data" / "places").glob("*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            place = {**data, "collectedAt": "2026-11-08T00:00:00+09:00", "source": "mock"}
            self.assertEqual(cp.validate(place), [], f.name)


OCTOPARSE_ROWS = [
    {"도입_URL": "https://map.naver.com/p/search/x/place/1084691809?c=15", "가게이름": None, "전체평점": "4.77",
     "방문자리뷰": "2,090", "리뷰작성자": "jia****", "리뷰작성자링크": "https://m.place.naver.com/my/abc/review",
     "리뷰작성수": "124", "팔로워": "71", "첨부이미지": None, "리뷰내용": "커피가 맛있어요\n또 올게요",
     "이런_점이_좋아요": None, "방문시간": "10.5.월", "방분횟수": "5번째 방문", "방문인증": "인증 수단\n영수증"},
]


class OctoparseFormat(unittest.TestCase):
    def test_team_octoparse_columns(self):
        rows = OCTOPARSE_ROWS + [dict(OCTOPARSE_ROWS[0])]  # 같은 리뷰가 두 번 들어간 경우
        report = {"warnings": [], "unknown": [], "blocked": []}
        reviews = cp.convert_reviews(rows, ref=REF, report=report, place_id="1084691809")
        self.assertEqual(len(reviews), 1)
        r = reviews[0]
        self.assertEqual(r["body"], "커피가 맛있어요\n또 올게요")
        self.assertEqual(r["visitedDate"], "2026-10-05")
        self.assertEqual(r["visitCount"], 5)
        self.assertEqual(r["authType"], "영수증")
        self.assertNotIn("hasOwnerReply", r)  # 답글 열이 없으면 확인 전
        self.assertEqual(sorted(report["blocked"]), ["리뷰작성수", "리뷰작성자", "리뷰작성자링크", "팔로워"])
        self.assertEqual(report["unknown"], [])  # 가게 단위 열은 조용히 넘긴다
        self.assertTrue(any("두 번" in w for w in report["warnings"]))
        self.assertNotIn("jia****", json.dumps(reviews, ensure_ascii=False))

    def test_wrong_store_file_is_error(self):
        with self.assertRaises(cp.ConvertError):
            cp.convert_reviews(OCTOPARSE_ROWS, ref=REF, place_id="9999999")

    def test_csv_keeps_newlines_in_review(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "r.csv"
            p.write_text('리뷰내용,방문시간\n"첫 줄\n둘째 줄",10.5.월\n', encoding="utf-8")
            rows = cp.read_table(p)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["리뷰내용"], "첫 줄\n둘째 줄")

    def test_broken_csv_message(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "broken.csv"
            p.write_bytes(b"?\x84\xec\x9e\x85_URL,\xea\xb0\x80?\x8c\n")
            with self.assertRaises(cp.ConvertError) as e:
                cp.read_table(p)
            self.assertIn("xlsx", str(e.exception))


if __name__ == "__main__":
    unittest.main()
