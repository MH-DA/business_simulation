import { Suspense } from "react";
import { AnalyzingProgress } from "@/components/AnalyzingProgress";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "가게를 분석하고 있어요" };

export default function AnalyzingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center px-4 pt-20 pb-24 text-center sm:pt-24">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">우리 가게를 살펴보고 있어요</h1>
        <p className="mt-3 text-[15px] text-muted">잠시만 기다려주세요. 보통 1분 안에 끝나요.</p>
        <div className="mt-10 flex w-full justify-center">
          <Suspense fallback={null}>
            <AnalyzingProgress />
          </Suspense>
        </div>
      </main>
    </>
  );
}
