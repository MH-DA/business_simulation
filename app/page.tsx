// 1단계 확인용 임시 페이지. 2단계에서 01 시작 페이지(Figma 시안)로 교체한다.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <span className="inline-block rounded-full bg-secondary px-4 py-1.5 text-xs font-medium text-secondary-foreground">
        우리 가게 상담 시작하기
      </span>
      <h1 className="mt-5 text-4xl font-bold">안녕하세요, 사장님!</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        가게를 먼저 살펴보고
        <br />
        지금 필요한 마케팅을 함께 찾아드릴게요.
      </p>

      <section className="mt-10 rounded-card border bg-card p-8">
        <label className="text-sm font-medium" htmlFor="url">
          네이버 플레이스 URL
        </label>
        <input
          id="url"
          placeholder="네이버 플레이스 링크를 붙여넣어 주세요."
          className="mt-3 h-14 w-full rounded-lg border bg-muted px-4 text-base placeholder:text-muted-foreground"
        />
        <button className="mt-4 h-14 w-full rounded-lg bg-primary text-base font-bold text-primary-foreground">
          우리 가게 분석하기
        </button>
      </section>
    </main>
  );
}
