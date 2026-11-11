import { AnalyzingView } from "@/components/AnalyzingView";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AnalyzingPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return (
    <>
      <SiteHeader />
      <AnalyzingView jobId={jobId} />
    </>
  );
}
