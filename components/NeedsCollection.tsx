import Link from "next/link";

// 미리 수집하지 않은 가게의 URL이 들어왔을 때. (시안에 없는 화면이라 같은 스타일로 만든 것)
export function NeedsCollection() {
  return (
    <section className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/mascot.png" alt="" width={166} height={130} />
      <h1 className="mt-6 text-[28px] font-bold">아직 분석 준비 중인 가게예요</h1>
      <p className="mt-3 max-w-[480px] leading-relaxed text-muted-foreground">
        이 가게의 공개 정보를 아직 모으지 못했어요. 분석 요청이 접수됐으니, 정보가 준비되면 같은 주소로 다시 확인해 주세요.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-[60px] w-[240px] items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110"
      >
        처음으로 돌아가기
      </Link>
    </section>
  );
}
