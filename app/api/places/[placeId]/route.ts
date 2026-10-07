import { NextResponse } from "next/server";
import { resolvePlace } from "@/lib/places";

export async function GET(_req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const resolved = await resolvePlace(placeId);
  if (resolved.status === "needs_collection") {
    return NextResponse.json({ status: "needs_collection" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", isDemo: resolved.isDemo, place: resolved.data });
}
