import type { CollectedPlace, Store } from "@/types";
import { daysSince } from "@/lib/metrics/comparison";

// 분석 결과 화면(Figma 04)에 그대로 뿌리는 값. 점수·순위 없이 사실만 담는다.
// "확인 전"(unknown)은 수집하지 못한 항목이다. 없음(off)과 구분해서 보여준다.

export type StatusState = "on" | "off" | "unknown";
export type StatusItem = { label: string; state: StatusState; text: string };

export type ReviewFact = { label: string; value: string; note?: string };

export type ResultViewModel = {
  store: Store;
  chips: string[];
  isDemo: boolean;
  collectedAt: string;
  status: StatusItem[];
  review: {
    visitorCount?: number;
    blogCount?: number;
    topKeywords: { keyword: string; count: number }[];
    facts: ReviewFact[]; // 수집한 리뷰에서 센 사실 (재방문, 답글, 사진)
  };
  assets: StatusItem[];
};

const NEWS_WINDOW_DAYS = 90;

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;

export function statusItems(store: Store, collectedAt: string): StatusItem[] {
  const photo: StatusItem =
    store.ownerPhotoCount === undefined
      ? { label: "업체 등록 사진", state: "unknown", text: "업체 사진 정보를 확인하지 못했어요" }
      : store.ownerPhotoCount > 0
        ? { label: "업체 등록 사진", state: "on", text: `업체 사진 ${store.ownerPhotoCount}장이 등록되어 있어요` }
        : { label: "업체 등록 사진", state: "off", text: "등록된 업체 사진이 없어요" };

  const bookingKnown = store.hasBookingTab !== undefined || store.tabs.length > 0;
  const booking = store.hasBookingTab ?? store.tabs.includes("예약");
  const reserve: StatusItem = !bookingKnown
    ? { label: "예약 탭", state: "unknown", text: "예약 탭 정보를 확인하지 못했어요" }
    : booking
      ? { label: "예약 탭", state: "on", text: "예약 탭이 열려 있어요" }
      : { label: "예약 탭", state: "off", text: "예약 탭이 없어요" };

  const days = daysSince(store.lastNewsDate, collectedAt);
  const news: StatusItem =
    days === undefined
      ? { label: "새소식 업데이트", state: "unknown", text: "새소식 정보를 확인하지 못했어요" }
      : days <= NEWS_WINDOW_DAYS
        ? { label: "새소식 업데이트", state: "on", text: days === 0 ? "오늘 새소식을 올렸어요" : `${days}일 전에 새소식을 올렸어요` }
        : { label: "새소식 업데이트", state: "off", text: `최근 ${NEWS_WINDOW_DAYS}일 내 새소식이 없어요` };

  const plus: StatusItem = store.hasPlacePlus
    ? { label: "플레이스 플러스", state: "on", text: "플레이스 플러스를 사용하고 있어요" }
    : { label: "플레이스 플러스", state: "off", text: "사용 정보가 없어요" };

  const pay: StatusItem =
    store.hasNaverPay === undefined
      ? { label: "네이버 페이 사용", state: "unknown", text: "결제 수단 정보를 확인하지 못했어요" }
      : store.hasNaverPay
        ? { label: "네이버 페이 사용", state: "on", text: "네이버 페이를 결제수단으로 사용할 수 있어요" }
        : { label: "네이버 페이 사용", state: "off", text: "네이버 페이 결제 정보가 없어요" };

  const coupon: StatusItem =
    store.coupons.length > 0
      ? { label: "쿠폰", state: "on", text: `이용 가능한 쿠폰이 ${store.coupons.length}개 있어요` }
      : { label: "쿠폰", state: "off", text: "이용 가능한 쿠폰이 없어요" };

  return [photo, reserve, news, plus, pay, coupon];
}

function reviewFacts(place: CollectedPlace): ReviewFact[] {
  const r = place.reviews;
  if (r.length === 0) return [];
  const note = `수집한 리뷰 ${r.length}개 기준`;
  const facts: ReviewFact[] = [];

  const withVisit = r.filter((x) => x.visitCount !== undefined);
  if (withVisit.length) {
    const again = withVisit.filter((x) => (x.visitCount ?? 0) >= 2).length;
    facts.push({ label: "다시 방문한 손님의 리뷰", value: pct(again, withVisit.length), note: `${withVisit.length}개 중 ${again}개` });
  }
  const withReply = r.filter((x) => x.hasOwnerReply !== undefined);
  if (withReply.length) {
    const replied = withReply.filter((x) => x.hasOwnerReply).length;
    facts.push({ label: "사장님 답글이 달린 리뷰", value: pct(replied, withReply.length), note: `${withReply.length}개 중 ${replied}개` });
  }
  const withPhoto = r.filter((x) => x.photoCount !== undefined);
  if (withPhoto.length) {
    const photo = withPhoto.filter((x) => (x.photoCount ?? 0) > 0).length;
    facts.push({ label: "사진이 있는 리뷰", value: pct(photo, withPhoto.length), note: `${withPhoto.length}개 중 ${photo}개` });
  }
  return facts.map((f, i) => (i === 0 ? { ...f, note: `${note} · ${f.note}` } : f));
}

export function buildResultView(place: CollectedPlace, isDemo: boolean): ResultViewModel {
  const { store, keywordStats, collectedAt } = place;
  const sorted = [...keywordStats].sort((a, b) => b.count - a.count);
  const chips = (store.representativeKeywords.length ? store.representativeKeywords : sorted.map((k) => k.keyword)).slice(0, 3);

  const assets: StatusItem[] = [
    store.instagramUrl
      ? { label: "인스타그램", state: "on", text: "네이버 플레이스에 인스타그램 링크가 등록되어 있어요." }
      : { label: "인스타그램", state: "off", text: "네이버 플레이스에 등록된 인스타그램 링크를 찾지 못했어요." },
    store.blogUrl
      ? { label: "네이버 블로그", state: "on", text: "네이버 플레이스에 블로그 링크가 등록되어 있어요." }
      : { label: "네이버 블로그", state: "off", text: "네이버 플레이스에 등록된 블로그 링크를 찾지 못했어요." },
  ];

  return {
    store,
    chips,
    isDemo,
    collectedAt,
    status: statusItems(store, collectedAt),
    review: {
      visitorCount: store.visitorReviewCount,
      blogCount: store.blogReviewCount,
      topKeywords: sorted.slice(0, 5).map((k) => ({ keyword: k.keyword, count: k.count })),
      facts: reviewFacts(place),
    },
    assets,
  };
}
