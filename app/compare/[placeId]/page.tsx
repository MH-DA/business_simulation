import { CompetitorForm } from "@/components/CompetitorForm";
import { NeedsCollection } from "@/components/NeedsCollection";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { resolvePlace } from "@/lib/places";

// 경쟁 가게 비교 1단계: 비교하고 싶은 가게의 URL 입력 (건너뛰기 가능). Figma 시안 나오면 모양만 바꾼다.
export default async function ComparePage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const resolved = await resolvePlace(placeId);

  return (
    <>
      <SiteHeader />
      <Panel className="flex min-h-[720px] flex-col items-center justify-center text-center">
        {resolved.status === "needs_collection" ? (
          <NeedsCollection />
        ) : (
          <>
            <p className="text-sm font-bold text-primary">경쟁 가게 비교</p>
            <h1 className="mt-3 break-keep text-[30px] font-bold leading-[1.4] sm:text-[38px]">
              {resolved.data.store.name}와(과)
              <br />
              비교해 보고 싶은 가게가 있나요?
            </h1>
            <p className="mt-3 break-keep text-base text-muted-foreground">
              자주 비교되거나 참고하고 싶은 가게의 네이버 플레이스 링크를 넣어 주세요. 같은 항목으로 나란히 보여드려요.
            </p>
            <div className="mt-16 w-full max-w-[660px]">
              <CompetitorForm placeId={placeId} />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
