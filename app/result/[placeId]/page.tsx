import { Suspense } from "react";
import { ConsultPanel } from "@/components/ConsultPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreBar, StoreCard, chipKeywords } from "@/components/StoreCard";
import { summarize, toPercent, MIN_REVIEWS } from "@/lib/metrics/summary";
import { MockProvider } from "@/lib/providers/mock";

export const metadata = { title: "우리 가게 분석 결과" };

// 02 분석 결과 + 03·04 챗봇 상담 (docs/design/02, 03, 04)
export default function ResultPage({ params }: PageProps<"/result/[placeId]">) {
  return (
    <>
      <SiteHeader variant="app" />
      <Suspense fallback={<ResultSkeleton />}>
        <ResultContent params={params} />
      </Suspense>
    </>
  );
}

function ResultSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pt-14 sm:px-6" aria-busy="true">
      <p className="text-sm text-muted">분석 결과를 불러오고 있어요…</p>
    </main>
  );
}

async function ResultContent({ params }: { params: PageProps<"/result/[placeId]">["params"] }) {
  const { placeId } = await params;
  // 3단계에서 Provider 폴백 체인(Demo → Crawler → Mock)으로 바꾼다
  const provider = new MockProvider();
  const place = await provider.collect(placeId);
  const competitors = await provider.getCompetitors(place.store);
  const summary = summarize(place, competitors);
  const { store } = place;
  const chips = chipKeywords(
    store,
    summary.topKeywords.map((k) => k.keyword),
  );

  const strengths = summary.topKeywords.map((k) => k.keyword);
  const lower = summary.lowerThanCompetitors;
  const industryWord = store.industry === "카페" || store.industry === "스터디카페" ? store.industry : "가게";

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 sm:px-6">
      <section aria-labelledby="result-title" className="pt-14">
        <h1 id="result-title" className="text-[28px] font-bold tracking-tight text-ink">
          우리 가게 분석이 끝났어요
        </h1>
        <p className="mt-2 text-sm text-muted">가게의 강점과 개선 기회를 확인하고, 고민을 함께 이야기해보세요.</p>

        <div className="mt-6 flex flex-col gap-5">
          <StoreCard store={store} chips={chips} />

          {!summary.enoughReviews && (
            <p className="rounded-2xl bg-mint px-6 py-4 text-sm text-ink">
              방문자 리뷰가 {MIN_REVIEWS}개보다 적어서, 아직 비율로 판단하기는 이른 단계예요. 아래 내용은 참고용으로 봐주세요.
            </p>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-line bg-card px-6 py-6">
              <h2 className="text-lg font-bold text-ink">자주 언급되는 강점</h2>
              <ul className="mt-4 space-y-1.5 text-[15px] text-muted">
                {summary.topKeywords.map((k) => (
                  <li key={k.keyword} className="flex justify-between gap-4">
                    <span>{k.keyword}</span>
                    <span className="flex-none text-sm text-faint">리뷰의 {toPercent(k.ratio)}%</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-3xl border border-line bg-card px-6 py-6">
              <h2 className="text-lg font-bold text-ink">근처 {industryWord}보다 덜 언급된 점</h2>
              {lower.length > 0 ? (
                <ul className="mt-4 space-y-1.5 text-[15px] text-muted">
                  {lower.map((g) => (
                    <li key={g.keyword} className="flex justify-between gap-4">
                      <span>{g.keyword}</span>
                      <span className="flex-none text-sm text-faint">
                        {g.mine}% · 평균 {g.competitorAvg}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[15px] text-muted">
                  {summary.competitorCount === 0
                    ? "비교할 근처 가게를 추가하면 보여드릴게요."
                    : "근처 가게보다 눈에 띄게 낮은 키워드는 없어요."}
                </p>
              )}
            </article>
          </div>

          <article className="rounded-3xl border border-line bg-card px-6 py-6">
            <h2 className="text-lg font-bold text-ink">리뷰 분석</h2>
            <p className="mt-4 text-sm font-semibold text-brand">리뷰에서 읽히는 우리 가게의 경험</p>
            <p className="mt-3 text-[15px] leading-7 text-muted">
              {strengths.length > 0 && <>‘{strengths.slice(0, 2).join("’, ‘")}’가 주요 강점으로 나타났어요. </>}
              {lower.length > 0 && (
                <>
                  한편 ‘{lower.map((g) => g.keyword).join("’, ‘")}’는 근처 {industryWord}보다 적게 선택됐어요.
                  <br />
                  실제 불편인지, 아직 손님에게 잘 알려지지 않은 점인지는 상담에서 함께 확인해볼 수 있어요.
                </>
              )}
            </p>
            <p className="mt-4 text-[11px] text-faint">
              샘플 분석 · 실제 리뷰와 수집 범위가 연결되면 근거 리뷰 및 분석 기준일을 표시합니다.
            </p>
          </article>

          <a
            href="#consult"
            className="block rounded-2xl bg-brand py-3.5 text-center text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            아래로 내려 상담 시작하기 <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section id="consult" aria-label="맞춤 마케팅 상담" className="mx-auto mt-24 max-w-[960px] scroll-mt-4">
        {/* 스크롤 시 상단에 고정. 뒤쪽 대화가 비치지 않도록 페이지 배경을 깐다 */}
        <div className="sticky top-0 z-10 -mx-2 bg-page px-2 pt-3 pb-3">
          <StoreBar store={store} chips={chips} />
        </div>
        <ConsultPanel />
      </section>
    </main>
  );
}
