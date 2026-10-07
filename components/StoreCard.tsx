import type { Store } from "@/types";

function PhotoBox({ store, size }: { store: Store; size: "lg" | "sm" }) {
  const box =
    size === "lg"
      ? "h-[156px] w-full sm:w-[224px] rounded-2xl"
      : "size-[72px] rounded-xl";
  if (store.photoUrl) {
    // 실제 사진이 연결되면 표시 (외부 이미지라 next/image 대신 img 사용)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={store.photoUrl} alt={`${store.name} 대표 사진`} className={`${box} flex-none object-cover`} />;
  }
  return (
    <div className={`${box} flex flex-none flex-col items-center justify-center bg-mint text-center`}>
      <span className={size === "lg" ? "text-lg font-medium text-brand" : "text-[11px] text-brand"}>가게 사진</span>
      {size === "lg" && <span className="mt-2 text-[11px] text-muted">플레이스 등록 사진 영역</span>}
    </div>
  );
}

export function KeywordChips({ keywords }: { keywords: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {keywords.map((k) => (
        <li key={k} className="min-w-[96px] rounded-full bg-mint px-4 py-1.5 text-center text-xs font-medium text-brand">
          {k}
        </li>
      ))}
    </ul>
  );
}

export function chipKeywords(store: Store, fallback: string[]) {
  return (store.representativeKeywords.length > 0 ? store.representativeKeywords : fallback).slice(0, 4);
}

// 02 분석 결과 상단의 큰 가게 카드
export function StoreCard({ store, chips }: { store: Store; chips: string[] }) {
  return (
    <article className="flex flex-col gap-6 rounded-3xl border border-line bg-card p-6 sm:flex-row sm:items-center">
      <PhotoBox store={store} size="lg" />
      <div className="min-w-0">
        <h2 className="text-2xl font-bold text-ink">
          {store.name}
          <span className="px-3 text-faint" aria-hidden="true">
            ·
          </span>
          <span className="sr-only">, 업종 </span>
          {store.category}
        </h2>
        {store.address && <p className="mt-3 text-sm text-muted">{store.address}</p>}
        <p className="mt-2 text-[15px] font-semibold text-brand">
          {store.rating !== undefined ? <>★ {store.rating} / 5</> : "별점 미노출"}
          {store.visitorReviewCount !== undefined && (
            <>
              <span className="px-2 text-faint" aria-hidden="true">
                ·
              </span>
              방문자 리뷰 {store.visitorReviewCount.toLocaleString()}
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-muted">현재 확인된 키워드</p>
        <div className="mt-2">
          <KeywordChips keywords={chips} />
        </div>
      </div>
    </article>
  );
}

// 03·04 상담 영역 위쪽에 고정되는 한 줄 요약 카드
export function StoreBar({ store, chips }: { store: Store; chips: string[] }) {
  return (
    <div className="flex items-center gap-5 rounded-3xl border border-line bg-card px-6 py-5">
      <PhotoBox store={store} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold text-ink">{store.name}</p>
        <div className="mt-2 hidden sm:block">
          <KeywordChips keywords={chips} />
        </div>
      </div>
      {store.rating !== undefined && (
        <p className="flex-none text-xl font-bold text-brand">
          <span aria-hidden="true">★ </span>
          <span className="sr-only">별점 </span>
          {store.rating}
        </p>
      )}
    </div>
  );
}
