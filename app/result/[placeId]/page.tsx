import { GuestGate } from "@/components/GuestGate";
import { NeedsCollection } from "@/components/NeedsCollection";
import { ResultView } from "@/components/ResultView";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { resolvePlace } from "@/lib/places";
import { buildResultView } from "@/lib/result-view";
import { getCurrentUser } from "@/lib/session";

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

  const view = buildResultView(resolved.data, resolved.isDemo);
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader />
      <Panel>
        {user ? (
          <ResultView view={view} />
        ) : (
          <GuestGate next={`/result/${encodeURIComponent(placeId)}`}>
            <ResultView view={view} locked />
          </GuestGate>
        )}
      </Panel>
    </>
  );
}
