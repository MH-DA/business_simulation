import type { CollectedPlace, Store } from "@/types";

// 교체 가능한 데이터 공급자. 엔진·화면은 이 인터페이스만 알고, 어디서 온 데이터인지 모른다.
export interface PlaceDataProvider {
  readonly name: string;

  // 한 매장의 수집 결과(스냅샷 한 장)를 돌려준다. 실패하면 throw → 폴백 체인이 다음 공급자로 넘어간다.
  collect(placeId: string): Promise<CollectedPlace>;

  // 사용자가 지정한 경쟁 매장 수집 결과. 지정이 없으면 빈 배열.
  getCompetitors(store: Store): Promise<CollectedPlace[]>;
}
