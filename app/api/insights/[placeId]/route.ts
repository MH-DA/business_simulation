import { NextResponse } from "next/server";
import { getInsights } from "@/lib/insights";
import { loadKnowledge } from "@/lib/knowledge";
import { selectGenerate } from "@/lib/llm";
import { resolvePlace } from "@/lib/places";

// GET /api/insights/:placeId → 리뷰 요약·제안 문구 (Insights). 결과 화면이 열린 뒤 따로 불러온다.
export async function GET(_req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const resolved = await resolvePlace(placeId);
  if (resolved.status === "needs_collection") {
    return NextResponse.json({ status: "needs_collection" }, { status: 404 });
  }
  const { guardrails } = await loadKnowledge();
  const insights = await getInsights(resolved.data, selectGenerate(), guardrails);
  return NextResponse.json(insights);
}
