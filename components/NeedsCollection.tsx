import Link from "next/link";

export function NeedsCollection() {
  return (
    <section className="rounded-card border bg-card p-8 text-center">
      <h2 className="text-2xl font-bold">아직 수집된 정보가 없는 가게예요</h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        이 가게의 공개 정보를 수집한 뒤에 분석 결과를 보여드릴 수 있어요.
        <br />
        수집 기능은 개발 마지막 단계에서 연결됩니다.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-lg bg-primary px-6 font-bold text-primary-foreground"
      >
        처음으로 돌아가기
      </Link>
    </section>
  );
}
