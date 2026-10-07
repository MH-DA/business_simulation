// 1단계 확인용 임시 페이지. 2단계에서 01 시작 페이지로 교체한다.
const swatches = [
  { name: "background", hex: "#f5f8f7", box: "bg-background border" },
  { name: "card", hex: "#ffffff", box: "bg-card border" },
  { name: "primary", hex: "#216c63", box: "bg-primary" },
  { name: "secondary", hex: "#e4eeea", box: "bg-secondary" },
  { name: "foreground", hex: "#193b39", box: "bg-foreground" },
  { name: "muted-foreground", hex: "#637975", box: "bg-muted-foreground" },
  { name: "border", hex: "#d6e1dd", box: "bg-border" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <span className="inline-block rounded-full bg-secondary px-4 py-1.5 text-xs font-medium text-secondary-foreground">
        디자인 토큰 확인 (임시)
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

      <section className="mt-10">
        <h2 className="text-lg font-bold">색상</h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {swatches.map((s) => (
            <li key={s.name} className="rounded-tile border bg-card p-3">
              <div className={`h-12 rounded-md ${s.box}`} />
              <p className="mt-2 text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.hex}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {["성수 카페", "핸드드립", "디저트", "조용한 카페"].map((k) => (
            <span key={k} className="rounded-full bg-secondary px-4 py-1.5 text-xs font-medium text-secondary-foreground">
              {k}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
