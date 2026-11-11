import type { CollectedPlace, Store } from "../../types/index.ts";
import type { PlaceDataProvider } from "../providers/types.ts";
import { getLatestSnapshot, listLatestSnapshots } from "./snapshots.ts";

// 저장된 수집 결과가 없을 때만 나는 예외. DB 접속 오류와 구분하려고 따로 둔다.
export class SnapshotNotFoundError extends Error {
  constructor(placeId: string) {
    super(`저장된 수집 결과가 없어요: ${placeId}`);
    this.name = "SnapshotNotFoundError";
  }
}

// snapshots 표에 저장된 수집 결과를 읽는 공급자. USE_MOCK_DATA=false 일 때 쓴다.
export class DbProvider implements PlaceDataProvider {
  readonly name = "db";

  async collect(placeId: string): Promise<CollectedPlace> {
    const found = await getLatestSnapshot(placeId);
    if (!found) throw new SnapshotNotFoundError(placeId);
    return found;
  }

  // 같은 업종의 다른 가게들 (MockProvider와 같은 기준)
  async getCompetitors(store: Store): Promise<CollectedPlace[]> {
    return listLatestSnapshots({ industry: store.industry, excludePlaceId: store.placeId });
  }
}
