import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "작업을 찾을 수 없어요." }, { status: 404 });
  return NextResponse.json(job);
}
