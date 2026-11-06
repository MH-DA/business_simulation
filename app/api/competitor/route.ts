import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { parsePlaceUrl } from "@/lib/place-url";
import { resolveCompetitor } from "@/lib/places";

// POST /api/competitor  { placeId, url }
//   200 { status: "ok", competitorId }        → 비교 화면으로 이동
//   404 { status: "needs_collection", ... }    → 아직 수집 전 (요청은 jobs 목록에 남긴다)
//   400 { error }                              → 링크 오류, 우리 가게와 같은 가게
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { placeId?: unknown; url?: unknown } | null;
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  const parsed = parsePlaceUrl(typeof body?.url === "string" ? body.url : "");
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.placeId === placeId) {
    return NextResponse.json({ error: "우리 가게와 다른 가게의 링크를 넣어 주세요." }, { status: 400 });
  }

  const resolved = await resolveCompetitor(parsed.placeId);
  if (resolved.status === "needs_collection") {
    createJob(parsed.placeId, "needs_collection");
    return NextResponse.json({ status: "needs_collection", competitorId: parsed.placeId }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", competitorId: parsed.placeId });
}
