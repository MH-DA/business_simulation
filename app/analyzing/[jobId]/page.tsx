import { AnalyzingView } from "@/components/AnalyzingView";

export default async function AnalyzingPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AnalyzingView jobId={jobId} />;
}
