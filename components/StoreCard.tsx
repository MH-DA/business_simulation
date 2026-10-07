import { Star } from "lucide-react";
import type { Store } from "@/types";
import { KeywordChip } from "./KeywordChip";

function PhotoTile({ store, size }: { store: Store; size: "lg" | "sm" }) {
  const box = size === "lg" ? "h-[156px] w-full sm:w-56" : "size-[72px]";
  if (store.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={store.photoUrl} alt={`${store.name} 사진`} className={`${box} shrink-0 rounded-tile object-cover`} />;
  }
  return (
    <div className={`${box} flex shrink-0 flex-col items-center justify-center rounded-tile bg-secondary text-center text-secondary-foreground`}>
      {size === "lg" ? (
        <>
          <span className="text-sm font-semibold">가게 사진</span>
          <span className="mt-1 text-xs text-muted-foreground">플레이스 등록 사진 영역</span>
        </>
      ) : (
        <span className="text-xs font-semibold">사진</span>
      )}
    </div>
  );
}

function Rating({ value }: { value?: number }) {
  if (value == null) return null;
  return (
    <span className="flex items-center gap-1 font-semibold text-primary">
      <Star className="size-4 fill-current" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}

export function StoreCard({ store, chips }: { store: Store; chips: string[] }) {
  return (
    <section className="flex flex-col gap-6 rounded-card border bg-card p-6 sm:flex-row sm:p-8">
      <PhotoTile store={store} size="lg" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[28px] font-bold leading-tight">
          {store.name} <span className="text-muted-foreground">· {store.category}</span>
        </h2>
        {store.address && <p className="mt-2 text-muted-foreground">{store.address}</p>}
        <div className="mt-2 text-lg">
          <Rating value={store.rating} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">현재 확인된 키워드</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <KeywordChip key={c}>{c}</KeywordChip>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CompactStoreCard({ store, chips }: { store: Store; chips: string[] }) {
  return (
    <div className="flex items-center gap-4 rounded-card border bg-card p-4 shadow-sm">
      <PhotoTile store={store} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-bold">{store.name}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {chips.slice(0, 3).map((c) => (
            <KeywordChip key={c} small>
              {c}
            </KeywordChip>
          ))}
        </div>
      </div>
      <div className="text-lg">
        <Rating value={store.rating} />
      </div>
    </div>
  );
}
