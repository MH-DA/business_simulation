import type { CollectedPlace } from "@/types";
import { getProvider } from "@/lib/providers";
import { hasPlace } from "@/lib/providers/mock";
import { DbProvider, SnapshotNotFoundError } from "@/lib/db/provider";
import { hasSnapshot } from "@/lib/db/snapshots";

// USE_MOCK_DATA 가 "false" 일 때만 실제 데이터 모드. 그 외(미설정 포함)는 Mock 모드.
// 실제 데이터 모드에서는 snapshots 표(DB)에 저장된 수집 결과만 읽는다. DATABASE_URL 이 필요하다. (db/schema.sql)
export function isMockMode(): boolean {
  return process.env.USE_MOCK_DATA !== "false";
}

export type ResolvedPlace =
  | { status: "ok"; data: CollectedPlace; isDemo: boolean }
  | { status: "needs_collection" };

// Mock 모드: 수집 파일이 있으면 그 데이터, 없으면 sample.json 으로 대신 보여주고 isDemo=true (화면에 안내 표시).
// 실제 데이터 모드: DB에 저장된 스냅샷이 없으면 "수집 필요". DB에 접속하지 못하면 예외가 나간다(가짜 데이터로 대신하지 않는다).
export async function resolvePlace(placeId: string): Promise<ResolvedPlace> {
  if (!isMockMode()) return resolveFromDb(placeId);
  const exists = await hasPlace(placeId);
  const data = await getProvider().collect(placeId);
  return { status: "ok", data, isDemo: !exists };
}

// 분석 요청을 받을 때 바로 "done" 으로 볼 수 있는지
export async function canAnalyze(placeId: string): Promise<boolean> {
  return isMockMode() ? true : hasSnapshot(placeId);
}

// 사장님이 직접 고른 비교(경쟁) 가게: 샘플로 대신 보여주지 않는다. 수집해 둔 가게만 비교한다.
export async function resolveCompetitor(placeId: string): Promise<ResolvedPlace> {
  if (!isMockMode()) return resolveFromDb(placeId);
  if (!(await hasPlace(placeId))) return { status: "needs_collection" };
  const data = await getProvider().collect(placeId);
  return { status: "ok", data, isDemo: false };
}

async function resolveFromDb(placeId: string): Promise<ResolvedPlace> {
  try {
    const data = await new DbProvider().collect(placeId);
    return { status: "ok", data, isDemo: false };
  } catch (e) {
    if (e instanceof SnapshotNotFoundError) return { status: "needs_collection" };
    throw e; // DB 접속 오류 등은 숨기지 않는다
  }
}
