import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "플레이스 링크 찾는 방법" };

// 플레이스 링크 찾는 방법 (docs/design/01a-guide-find-place-link.png)
export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-4 pt-20 pb-24 sm:pt-28">
        <h1 className="text-base font-semibold text-ink">플레이스 링크 찾는 방법</h1>

        <section className="mt-5 rounded-2xl bg-mint px-6 py-8 text-center sm:px-8">
          <h2 className="text-[15px] font-medium text-brand underline underline-offset-4">
            우리 가게 링크, 이렇게 가져오세요
          </h2>
          <p className="mt-6 text-[15px] leading-7 text-ink">네이버 또는 네이버 지도에서 우리 가게 이름을 검색해주세요.</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-left text-[15px] leading-7 text-ink sm:pl-8">
            <li>주소를 확인하고 우리 가게 상세 페이지를 열어주세요.</li>
            <li>[공유] 또는 [상단 인터넷 주소]를 클릭하여 링크를 복사해주세요.</li>
            <li>이 화면으로 돌아와 입력창에 붙여넣기해주세요.</li>
          </ol>
          <p className="mt-6 text-[15px] text-ink">같은 이름의 가게가 있다면, 주소가 맞는지 꼭 확인해주세요!</p>
        </section>

        <Link
          href="/"
          className="mt-3 rounded-xl bg-brand py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          우리 가게 분석하러 가기
        </Link>
      </main>
    </>
  );
}
