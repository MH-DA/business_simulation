import type { Store, UncheckedField } from "../types/index.ts";

// 있음(true) / 없음(false) / 확인 전(undefined).
// 수집하지 못한 항목(store.unchecked)을 "없음"으로 보여주지 않기 위한 공통 판단. (프로젝트 지침 2장)
export const isUnchecked = (s: Store, f: UncheckedField) => s.unchecked?.includes(f) ?? false;

const known = (s: Store, f: UncheckedField, v: boolean) => (isUnchecked(s, f) ? undefined : v);

export const hasIntro = (s: Store) => known(s, "intro", Boolean(s.intro?.trim()));
export const hasAmenities = (s: Store) => known(s, "amenities", s.amenities.length > 0);
// 수집기는 쿠폰 유무만 확인한다(hasCoupon). 없으면 예전 데이터처럼 쿠폰 목록으로 판단
export const hasCoupons = (s: Store) => s.hasCoupon ?? known(s, "coupons", s.coupons.length > 0);
export const hasRepresentativeKeywords = (s: Store) => known(s, "representativeKeywords", s.representativeKeywords.length > 0);
export const hasInstagram = (s: Store) => known(s, "instagramUrl", Boolean(s.instagramUrl));
export const hasBlog = (s: Store) => known(s, "blogUrl", Boolean(s.blogUrl));
export const hasBookingTab = (s: Store) => s.hasBookingTab ?? known(s, "tabs", s.tabs.includes("예약"));
