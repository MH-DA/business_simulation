import type { CollectedPlace, Store } from "@/types";
import { buildComparison, type Comparison } from "@/lib/metrics/comparison";
import { statusItems, type StatusItem } from "@/lib/result-view";

// 경쟁 가게 비교 화면 값: 우리 가게와 사장님이 고른 가게를 같은 항목으로 나란히. 점수·순위 없음.
export type CompareSide = {
  store: Pick<Store, "placeId" | "name" | "category" | "rating">;
  status: StatusItem[];
  topKeywords: string[];
  sns: { instagram: boolean; blog: boolean };
};

export type CompareViewModel = {
  mine: CompareSide;
  other: CompareSide;
  numbers: Comparison; // 별점, 리뷰 수, 소개글, 편의시설, 쿠폰, 예약, 네이버페이, 최근 새소식
};

function side(place: CollectedPlace): CompareSide {
  const { store } = place;
  return {
    store: { placeId: store.placeId, name: store.name, category: store.category, rating: store.rating },
    status: statusItems(store, place.collectedAt),
    topKeywords: [...place.keywordStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((k) => k.keyword),
    sns: { instagram: Boolean(store.instagramUrl), blog: Boolean(store.blogUrl) },
  };
}

export function buildCompareView(mine: CollectedPlace, other: CollectedPlace): CompareViewModel {
  return {
    mine: side(mine),
    other: side(other),
    numbers: buildComparison(mine.store, other.store, mine.collectedAt),
  };
}
