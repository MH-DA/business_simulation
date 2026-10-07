import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { StartForm } from "@/components/StartForm";

// 01 시작 페이지 (docs/design/01-start.png)
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center px-4 pt-20 pb-24 text-center sm:pt-24">
        <span className="rounded-full bg-mint px-5 py-1.5 text-xs font-medium text-brand">
          우리 가게 상담 시작하기
        </span>
        <h1 className="mt-5 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">안녕하세요, 사장님!</h1>
        <p className="mt-4 text-[15px] leading-7 text-muted">
          가게를 먼저 살펴보고
          <br />
          지금 필요한 마케팅을 함께 찾아드릴게요.
        </p>
        <p className="mt-3 text-[15px] font-semibold text-ink">네이버 플레이스 링크를 보내주세요!</p>

        <div className="mt-7 flex w-full justify-center">
          <StartForm />
        </div>

        <p className="mt-6 text-xs text-muted">가게 분석에서 실행 방법까지, 사장님과 함께 찾아갑니다.</p>
        <Link href="/guide" className="mt-3 text-xs text-muted underline underline-offset-4 hover:text-brand">
          플레이스 링크 찾는 방법
        </Link>
      </main>
    </>
  );
}
