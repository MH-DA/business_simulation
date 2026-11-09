import type { CollectedPlace, Store } from "@/types";
import { buildComparison, buildDifferences, type Comparison, type Differences } from "@/lib/metrics/comparison";
import { statusItems, type StatusItem } from "@/lib/result-view";
import { hasBlog, hasInstagram, hasIntro } from "@/lib/checked";

// 경쟁 가게 비교 화면 값: 우리 가게와 사장님이 고른 가게를 같은 항목으로 나란히. 점수·순위 없음.
export type CompareSide = {
  store: Pick<Store, "placeId" | "name" | "category" | "rating" | "intro" | "visitorReviewCount" | "blogReviewCount">;
  status: StatusItem[];
  topKeywords: string[];
  sns: { instagram: boolean | undefined; blog: boolean | undefined };
  introUnchecked: boolean; // 소개글을 수집하지 못함 → "확인 전"
};

export type CompareViewModel = {
  mine: CompareSide;
  other: CompareSide;
  numbers: Comparison; // 별점, 리뷰 수, 소개글, 편의시설, 쿠폰, 예약, 네이버페이, 최근 새소식
  differences: Differences; // 각 가게 쪽이 더 많거나 있는 항목 (판정 없음)
};

function side(place: CollectedPlace): CompareSide {
  const { store } = place;
  return {
    store: {
      placeId: store.placeId,
      name: store.name,
      category: store.category,
      rating: store.rating,
      intro: store.intro,
      visitorReviewCount: store.visitorReviewCount,
      blogReviewCount: store.blogReviewCount,
    },
    status: statusItems(store, place.collectedAt),
    topKeywords: [...place.keywordStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((k) => k.keyword),
    sns: { instagram: hasInstagram(store), blog: hasBlog(store) }, // undefined = 확인 전
    introUnchecked: hasIntro(store) === undefined,
  };
}

export function buildCompareView(mine: CollectedPlace, other: CollectedPlace): CompareViewModel {
  return {
    mine: side(mine),
    other: side(other),
    numbers: buildComparison(mine.store, other.store, mine.collectedAt),
    differences: buildDifferences(mine.store, other.store),
  };
}
