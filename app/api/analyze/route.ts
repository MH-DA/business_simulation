import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { canAnalyze } from "@/lib/places";
import { parsePlaceUrl } from "@/lib/place-url";

// POST /api/analyze  { url, industry? } → { jobId, placeId, status }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const parsed = parsePlaceUrl(typeof body?.url === "string" ? body.url : "");
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const status = (await canAnalyze(parsed.placeId)) ? "done" : "needs_collection";
  const job = createJob(parsed.placeId, status);
  return NextResponse.json({ jobId: job.jobId, placeId: job.placeId, status: job.status });
}
