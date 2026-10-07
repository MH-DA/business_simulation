import type { CollectedPlace } from "@/types";
import { getProvider } from "@/lib/providers";
import { hasPlace } from "@/lib/providers/mock";

// USE_MOCK_DATA 가 "false" 일 때만 실제 수집을 기다린다. 그 외(미설정 포함)는 Mock 모드.
export function isMockMode(): boolean {
  return process.env.USE_MOCK_DATA !== "false";
}

export type ResolvedPlace =
  | { status: "ok"; data: CollectedPlace; isDemo: boolean }
  | { status: "needs_collection" };

// Mock 모드: 수집 파일이 있으면 그 데이터, 없으면 sample.json 으로 대신 보여주고 isDemo=true (화면에 안내 표시).
// 실제 모드(6단계 전): 수집 파일이 없으면 "수집 필요".
export async function resolvePlace(placeId: string): Promise<ResolvedPlace> {
  const exists = await hasPlace(placeId);
  if (!exists && !isMockMode()) return { status: "needs_collection" };
  const data = await getProvider().collect(placeId);
  return { status: "ok", data, isDemo: !exists };
}

// 분석 요청을 받을 때 바로 "done" 으로 볼 수 있는지
export async function canAnalyze(placeId: string): Promise<boolean> {
  return isMockMode() || (await hasPlace(placeId));
}
