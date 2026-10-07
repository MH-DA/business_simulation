import { promises as fs } from "node:fs";
import path from "node:path";
import type { CollectedPlace, Store } from "@/types";
import type { PlaceDataProvider } from "./types";

const PLACES_DIR = path.join(process.cwd(), "data", "places");
const FALLBACK_FILE = "sample.json";

type PlaceFile = Omit<CollectedPlace, "collectedAt" | "source">;

async function loadAll(): Promise<Map<string, PlaceFile>> {
  const files = (await fs.readdir(PLACES_DIR)).filter((f) => f.endsWith(".json"));
  const map = new Map<string, PlaceFile>();
  for (const file of files) {
    const raw = await fs.readFile(path.join(PLACES_DIR, file), "utf-8");
    const data = JSON.parse(raw) as PlaceFile;
    map.set(data.store.placeId, data);
  }
  return map;
}

function toCollected(data: PlaceFile): CollectedPlace {
  return { ...data, collectedAt: new Date().toISOString(), source: "mock" };
}

// placeId 에 해당하는 수집 파일이 있는지 (없으면 sample.json 으로 대신 보여주게 된다)
export async function hasPlace(placeId: string): Promise<boolean> {
  return (await loadAll()).has(placeId);
}

// data/places/*.json 의 가짜 데이터를 돌려준다. 개발 기본값 (USE_MOCK_DATA=true).
export class MockProvider implements PlaceDataProvider {
  readonly name = "mock";

  async collect(placeId: string): Promise<CollectedPlace> {
    const all = await loadAll();
    const found = all.get(placeId);
    if (found) return toCollected(found);

    // 매칭되는 매장이 없으면 sample.json 으로 대신한다 (화면 개발용).
    const raw = await fs.readFile(path.join(PLACES_DIR, FALLBACK_FILE), "utf-8");
    return toCollected(JSON.parse(raw) as PlaceFile);
  }

  // Mock에서는 같은 업종의 다른 매장을 경쟁 매장으로 본다.
  async getCompetitors(store: Store): Promise<CollectedPlace[]> {
    const all = await loadAll();
    return [...all.values()]
      .filter((d) => d.store.placeId !== store.placeId && d.store.industry === store.industry)
      .map(toCollected);
  }
}
