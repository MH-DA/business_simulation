import { NeedsCollection } from "@/components/NeedsCollection";
import { ResultView } from "@/components/ResultView";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { resolvePlace } from "@/lib/places";
import { getProvider } from "@/lib/providers";
import { buildResultView } from "@/lib/result-view";

export default async function ResultPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const resolved = await resolvePlace(placeId);

  if (resolved.status === "needs_collection") {
    return (
      <>
        <SiteHeader />
        <Panel className="flex min-h-[720px] flex-col items-center justify-center">
          <NeedsCollection />
        </Panel>
      </>
    );
  }

  const competitors = await getProvider().getCompetitors(resolved.data.store);
  const view = buildResultView(resolved.data, competitors, resolved.isDemo);
  return (
    <>
      <SiteHeader />
      <Panel>
        <ResultView view={view} />
      </Panel>
    </>
  );
}
