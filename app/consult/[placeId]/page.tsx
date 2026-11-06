import { ConsultView } from "@/components/ConsultView";
import { NeedsCollection } from "@/components/NeedsCollection";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { resolvePlace } from "@/lib/places";

// Figma 05 · 성향 파악 1~5 → 05 · 마케팅 상담 / 시작 → 05b · 대화 중
export default async function ConsultPage({
  params,
  searchParams,
}: {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ with?: string | string[] }>;
}) {
  const { placeId } = await params;
  const w = (await searchParams).with;
  const competitorId = typeof w === "string" && /^[\w-]{1,40}$/.test(w) ? w : undefined; // 비교 화면에서 넘어온 경우
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

  const { store, keywordStats } = resolved.data;
  const topKeywords = [...keywordStats].sort((a, b) => b.count - a.count).slice(0, 2).map((k) => k.keyword);
  return (
    <>
      <SiteHeader />
      <ConsultView
        store={{ placeId: store.placeId, name: store.name, category: store.category, rating: store.rating }}
        topKeywords={topKeywords}
        competitorId={competitorId}
      />
    </>
  );
}
