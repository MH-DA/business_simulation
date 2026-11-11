import { CompetitorForm } from "@/components/CompetitorForm";
import { NeedsCollection } from "@/components/NeedsCollection";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { redirect } from "next/navigation";
import { resolvePlace } from "@/lib/places";
import { getCurrentUser, loginHref } from "@/lib/session";

// Figma 05. 경쟁사 분석 URL (+ 분석 중). 비교하고 싶은 가게의 URL 입력, 건너뛰기 가능.
export default async function ComparePage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  if (!(await getCurrentUser())) redirect(loginHref(`/compare/${encodeURIComponent(placeId)}`));
  const resolved = await resolvePlace(placeId);

  return (
    <>
      <SiteHeader />
      <Panel className="flex min-h-[720px] flex-col items-center justify-center text-center">
        {resolved.status === "needs_collection" ? (
          <NeedsCollection />
        ) : (
          <CompetitorForm placeId={placeId} />
        )}
      </Panel>
    </>
  );
}
