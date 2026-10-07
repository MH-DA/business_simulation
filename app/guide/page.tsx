import Link from "next/link";
import { LandingHeader } from "@/components/SiteHeader";

export default function GuidePage() {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-6 pb-16 pt-6">
        <h1 className="text-center text-[32px] font-bold">플레이스 링크 찾는 방법</h1>
        <section className="mt-8 rounded-card bg-secondary p-8 text-center">
          <h2 className="text-lg font-bold text-primary underline underline-offset-4">
            우리 가게 링크, 이렇게 가져오세요
          </h2>
          <p className="mt-4">네이버 또는 네이버 지도에서 우리 가게 이름을 검색해주세요.</p>
          <ol className="mx-auto mt-5 flex max-w-md list-decimal flex-col gap-3 pl-5 text-left leading-relaxed">
            <li>주소를 확인하고 우리 가게 상세 페이지를 열어주세요.</li>
            <li>[공유] 또는 [상단 인터넷 주소]를 클릭하여 링크를 복사해주세요.</li>
            <li>이 화면으로 돌아와 입력창에 붙여넣기해주세요.</li>
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">
            같은 이름의 가게가 있다면, 주소가 맞는지 꼭 확인해주세요!
          </p>
        </section>
        <Link
          href="/"
          className="mt-6 flex h-[58px] w-full items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground transition hover:opacity-90"
        >
          우리 가게 분석하러 가기
        </Link>
      </main>
    </>
  );
}
