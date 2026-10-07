// 네이버 플레이스 링크에서 placeId 를 꺼낸다. 붙여넣은 공유 문구 속 링크도 처리한다.
export type ParseResult = { ok: true; placeId: string } | { ok: false; error: string };

const HOSTS = new Set([
  "map.naver.com",
  "m.map.naver.com",
  "place.naver.com",
  "m.place.naver.com",
  "pcmap.place.naver.com",
]);

export function parsePlaceUrl(input: string): ParseResult {
  const text = (input ?? "").trim();
  if (!text) return { ok: false, error: "네이버 플레이스 링크를 붙여넣어 주세요." };

  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return { ok: false, error: "링크 형식이 아니에요. 네이버 플레이스 링크를 붙여넣어 주세요." };

  let url: URL;
  try {
    url = new URL(match[0]);
  } catch {
    return { ok: false, error: "링크 형식이 아니에요. 네이버 플레이스 링크를 붙여넣어 주세요." };
  }

  const host = url.hostname.toLowerCase();
  if (host === "naver.me") {
    return {
      ok: false,
      error: "짧은 링크(naver.me)는 아직 읽을 수 없어요. 네이버 지도에서 열린 주소창의 전체 링크를 붙여넣어 주세요.",
    };
  }
  if (!HOSTS.has(host)) {
    return { ok: false, error: "네이버 플레이스 링크가 아닌 것 같아요. 네이버 지도나 플레이스 주소를 붙여넣어 주세요." };
  }

  const id = url.pathname.split("/").find((seg) => /^\d{5,}$/.test(seg));
  if (!id) {
    return { ok: false, error: "링크에서 가게 번호를 찾지 못했어요. 가게 상세 페이지의 주소를 붙여넣어 주세요." };
  }
  return { ok: true, placeId: id };
}
