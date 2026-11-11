import type { CollectedPlace } from "../../types/index.ts";
import { INDUSTRIES } from "../../types/index.ts";
import type postgres from "postgres";
import { getSql } from "./index.ts";

// snapshots 표 읽기·쓰기. 수집 결과 한 장(CollectedPlace 전체)을 payload(jsonb)에 그대로 넣는다. (db/schema.sql)
// payload 모양이 바뀌면 이 숫자를 올린다.
export const SNAPSHOT_SCHEMA_VERSION = 1;

const SOURCES = ["crawler", "octoparse", "manual", "mock", "demo"];

// DB에서 꺼낸 jsonb(또는 업로드할 JSON 파일)가 CollectedPlace 모양인지 확인한다.
// 값을 고치거나 채우지 않는다. 모양이 틀리면 어디가 틀렸는지 알려 주고 멈춘다.
export function parseSnapshotPayload(raw: unknown): CollectedPlace {
  const bad = (why: string): never => {
    throw new Error(`수집 결과 모양이 달라요: ${why}`);
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return bad("JSON 객체가 아니에요");
  const p = raw as Record<string, unknown>;
  const store = p.store as Record<string, unknown> | undefined;
  if (typeof store !== "object" || store === null) return bad("store 가 없어요");
  if (typeof store.placeId !== "string" || !store.placeId) return bad("store.placeId 가 없어요");
  if (typeof store.name !== "string" || !store.name) return bad("store.name 이 없어요");
  if (!(INDUSTRIES as readonly string[]).includes(store.industry as string)) {
    return bad(`store.industry 가 ${INDUSTRIES.join("/")} 중 하나가 아니에요`);
  }
  if (!Array.isArray(p.keywordStats)) return bad("keywordStats 가 배열이 아니에요");
  if (!Array.isArray(p.reviews)) return bad("reviews 가 배열이 아니에요");
  if (typeof p.collectedAt !== "string" || Number.isNaN(Date.parse(p.collectedAt))) return bad("collectedAt 이 날짜가 아니에요");
  if (!SOURCES.includes(p.source as string)) return bad(`source 가 ${SOURCES.join("/")} 중 하나가 아니에요`);
  return raw as CollectedPlace;
}

// 가게의 가장 최근 스냅샷. 없으면 undefined.
export async function getLatestSnapshot(placeId: string): Promise<CollectedPlace | undefined> {
  const sql = getSql();
  const rows = await sql<{ payload: unknown }[]>`
    select payload from snapshots
    where place_id = ${placeId}
    order by collected_at desc
    limit 1`;
  return rows[0] ? parseSnapshotPayload(rows[0].payload) : undefined;
}

export async function hasSnapshot(placeId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`select 1 from snapshots where place_id = ${placeId} limit 1`;
  return rows.length > 0;
}

// 같은 업종 다른 가게들의 가장 최근 스냅샷 (가게마다 한 장씩)
export async function listLatestSnapshots(opts: { industry: string; excludePlaceId: string; limit?: number }): Promise<CollectedPlace[]> {
  const sql = getSql();
  const rows = await sql<{ payload: unknown }[]>`
    select distinct on (s.place_id) s.payload
    from snapshots s
    join places p on p.place_id = s.place_id
    where p.industry = ${opts.industry} and s.place_id <> ${opts.excludePlaceId}
    order by s.place_id, s.collected_at desc
    limit ${opts.limit ?? 20}`;
  return rows.map((r) => parseSnapshotPayload(r.payload));
}

// 가게(places)와 스냅샷(snapshots)을 한 번에 저장한다. 둘 중 하나라도 실패하면 둘 다 취소된다.
// 같은 가게를 같은 수집 시각으로 다시 올리면 새 줄이 아니라 그 줄을 덮어쓴다.
export async function saveSnapshot(input: unknown): Promise<{ id: string; placeId: string; created: boolean }> {
  const place = parseSnapshotPayload(input);
  const { store } = place;
  const collectedAt = new Date(place.collectedAt);
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`
      insert into places (place_id, name, industry, category, address)
      values (${store.placeId}, ${store.name}, ${store.industry}, ${store.category ?? null}, ${store.address ?? null})
      on conflict (place_id) do update
        set name = excluded.name, industry = excluded.industry, category = excluded.category,
            address = excluded.address, updated_at = now()`;
    const rows = await tx<{ id: string; inserted: boolean }[]>`
      insert into snapshots (place_id, collected_at, source, schema_version, payload)
      values (${store.placeId}, ${collectedAt}, ${place.source}, ${SNAPSHOT_SCHEMA_VERSION}, ${tx.json(place as unknown as postgres.JSONValue)})
      on conflict (place_id, collected_at) do update
        set source = excluded.source, schema_version = excluded.schema_version, payload = excluded.payload
      returning id, (xmax = 0) as inserted`;
    return { id: rows[0].id, placeId: store.placeId, created: rows[0].inserted };
  });
}
