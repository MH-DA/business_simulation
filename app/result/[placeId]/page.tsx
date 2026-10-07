import { NeedsCollection } from "@/components/NeedsCollection";
import { ResultView } from "@/components/ResultView";
import { ResultHeader } from "@/components/SiteHeader";
import { resolvePlace } from "@/lib/places";
import { getProvider } from "@/lib/providers";
import { buildResultView } from "@/lib/result-view";

export default async function ResultPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const resolved = await resolvePlace(placeId);

  if (resolved.status === "needs_collection") {
    return (
      <>
        <ResultHeader />
        <main className="mx-auto w-full max-w-[640px] px-6 py-16">
          <NeedsCollection />
        </main>
      </>
    );
  }

  const competitors = await getProvider().getCompetitors(resolved.data.store);
  const view = buildResultView(resolved.data, competitors, resolved.isDemo);
  return (
    <>
      <ResultHeader />
      <ResultView view={view} />
    </>
  );
}
