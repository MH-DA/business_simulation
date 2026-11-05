import { Panel, SiteHeader } from "@/components/SiteHeader";
import { StartForm } from "@/components/StartForm";

// Figma 01 · 시작 화면 (+ 입력창 선택 / URL 입력 / URL 오류 / URL 안내)
export default function Home() {
  return (
    <>
      <SiteHeader />
      <Panel className="flex min-h-[720px] flex-col items-center justify-center text-center">
        <h1 className="text-[34px] font-bold leading-[1.35] sm:text-[44px]">
          오늘은 우리 가게에
          <br />
          어떤 마케팅이 필요할까요?
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          가게를 먼저 살펴보고, 오늘 실천할 수 있는 마케팅을 제안해드릴게요.
        </p>
        <div className="mt-24 w-full max-w-[660px]">
          <StartForm />
        </div>
      </Panel>
    </>
  );
}
