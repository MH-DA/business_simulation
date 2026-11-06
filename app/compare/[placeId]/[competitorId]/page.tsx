import Link from "next/link";
import { CompareView } from "@/components/CompareView";
import { NeedsCollection } from "@/components/NeedsCollection";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { buildCompareView } from "@/lib/compare-view";
import { resolveCompetitor, resolvePlace } from "@/lib/places";

// 경쟁 가게 비교 2단계: 결과. 상담 화면에서 "경쟁 가게 비교 다시 보기"로 돌아오는 곳이기도 하다.
export default async function CompareResultPage({ params }: { params: Promise<{ placeId: string; competitorId: string }> }) {
  const { placeId, competitorId } = await params;
  const [mine, other] = await Promise.all([resolvePlace(placeId), resolveCompetitor(competitorId)]);

  if (mine.status === "needs_collection" || other.status === "needs_collection") {
    return (
      <>
        <SiteHeader />
        <Panel className="flex min-h-[720px] flex-col items-center justify-center text-center">
          <NeedsCollection />
          {mine.status === "ok" && (
            <Link href={`/consult/${encodeURIComponent(placeId)}`} className="mt-4 text-sm text-primary underline underline-offset-4">
              비교 없이 상담 시작하기
            </Link>
          )}
        </Panel>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <Panel>
        <CompareView view={buildCompareView(mine.data, other.data)} />
      </Panel>
    </>
  );
}
