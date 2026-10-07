import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlaceUrl } from "./place-url.ts";

const id = (s: string) => {
  const r = parsePlaceUrl(s);
  return r.ok ? r.placeId : null;
};

test("지원하는 주소 형식", () => {
  assert.equal(id("https://map.naver.com/p/entry/place/1234567"), "1234567");
  assert.equal(id("https://m.place.naver.com/restaurant/1234567/home"), "1234567");
  assert.equal(id("https://place.naver.com/place/1234567"), "1234567");
  assert.equal(id("https://pcmap.place.naver.com/place/1234567/home?x=1"), "1234567");
  assert.equal(id("https://m.map.naver.com/place/1234567"), "1234567");
});

test("공유 문구 속 링크에서 추출", () => {
  assert.equal(id("우리 가게 https://map.naver.com/p/entry/place/7654321?c=15 보세요"), "7654321");
});

test("잘못된 입력", () => {
  assert.equal(parsePlaceUrl("").ok, false);
  assert.equal(parsePlaceUrl("안녕하세요").ok, false);
  assert.equal(parsePlaceUrl("https://example.com/place/1234567").ok, false);
  assert.equal(parsePlaceUrl("https://map.naver.com/p/search/카페").ok, false);
});

test("naver.me 단축 링크는 안내 메시지", () => {
  const r = parsePlaceUrl("https://naver.me/abcd");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /짧은 링크/);
});
