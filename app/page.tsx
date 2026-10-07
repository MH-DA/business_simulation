import Link from "next/link";
import { LandingHeader } from "@/components/SiteHeader";
import { StartForm } from "@/components/StartForm";

export default function Home() {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center px-6 pb-16 pt-10 text-center">
        <span className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
          우리 가게 상담 시작하기
        </span>
        <h1 className="mt-5 text-[40px] font-bold leading-tight">안녕하세요, 사장님!</h1>
        <p className="mt-4 text-xl leading-relaxed text-muted-foreground">
          가게를 먼저 살펴보고
          <br />
          지금 필요한 마케팅을 함께 찾아드릴게요.
        </p>
        <p className="mt-12 text-lg font-semibold">네이버 플레이스 링크를 보내주세요!</p>
        <div className="mt-5 w-full text-left">
          <StartForm />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          가게 분석에서 실행 방법까지, 사장님과 함께 찾아갑니다.{" "}
          <Link href="/guide" className="font-medium text-primary underline underline-offset-4">
            플레이스 링크 찾는 방법
          </Link>
        </p>
      </main>
    </>
  );
}
