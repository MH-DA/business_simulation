"use client";

import { ArrowDown, ChevronLeft, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CompareSide, CompareViewModel } from "@/lib/compare-view";
import type { Insights } from "@/lib/insights";
import type { Difference } from "@/lib/metrics/comparison";
import type { StatusState } from "@/lib/result-view";

// Figma 05 · 경쟁사 분석 / 1:1 스크롤 비교
// 시안의 "강점과 약점" 자리는 판정 없이 "두 가게의 차이"(코드가 계산한 사실)로 보여준다. (docs/design/README.md)

type Tone = "mine" | "other";

const TONE = {
  mine: { head: "bg-secondary text-primary", star: "text-primary", chip: "bg-secondary text-primary", label: "우리 가게" },
  other: { head: "bg-info text-info-foreground", star: "text-star", chip: "bg-info text-info-foreground", label: "경쟁사" },
} as const;

const snsState = (v: boolean | undefined): StatusState => (v === undefined ? "unknown" : v ? "on" : "off");

const count = (n?: number) => (n === undefined ? "확인 전" : `${n.toLocaleString("ko-KR")}개`);

function useInsights(placeId: string): Insights | null | undefined {
  // undefined: 불러오는 중, null: 불러오지 못함
  const [data, setData] = useState<Insights | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch(`/api/insights/${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Insights>) : null))
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [placeId]);
  return data;
}

function Pill({ state }: { state: StatusState }) {
  const on = state === "on";
  return (
    <span className={`inline-flex h-[22px] w-14 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${on ? "bg-primary text-white" : "bg-off-pill text-off-pill-text"}`}>
      {on ? "ON" : state === "off" ? "OFF" : "확인 전"}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-off-border px-6 py-3.5 last:border-0">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function InsightText({ value, pick }: { value: Insights | null | undefined; pick: (i: Insights) => string }) {
  if (value === undefined) return <p className="animate-pulse text-[13px] text-off-text">AI가 리뷰를 읽고 정리하고 있어요…</p>;
  if (value === null) return <p className="text-off-text">정리하지 못했어요</p>;
  return <p className="break-keep">{pick(value)}</p>;
}

function SideCard({ side, tone, extra }: { side: CompareSide; tone: Tone; extra: { item: string; value: string }[] }) {
  const t = TONE[tone];
  const insights = useInsights(side.store.placeId);
  const { store } = side;
  return (
    <section className="flex h-[362px] flex-col rounded-card bg-card p-[11px]" aria-label={`${t.label} 정보`}>
      <h2 className={`rounded-tile px-3 py-2 text-xl font-bold ${t.head}`}>{t.label}</h2>
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain" tabIndex={0}>
        <Row label="가게 이름">
          <p className="text-[18px] font-bold">{store.name}</p>
        </Row>
        <Row label="평점">
          {store.rating != null ? <p className={`text-[18px] font-bold ${t.star}`}>★ {store.rating.toFixed(1)}</p> : <p className="text-off-text">확인 전</p>}
        </Row>
        <Row label="소개글">
          {store.intro?.trim() ? (
            <p className="line-clamp-4 break-keep">{store.intro}</p>
          ) : (
            <p className="text-off-text">{side.introUnchecked ? "확인 전" : "등록된 소개글이 없어요"}</p>
          )}
        </Row>
        <Row label="리뷰 수">
          <p>
            방문자 리뷰 {count(store.visitorReviewCount)} · 블로그 리뷰 {count(store.blogReviewCount)}
          </p>
        </Row>
        <Row label="고객이 좋아하는 점">
          <InsightText value={insights} pick={(i) => i.likes} />
        </Row>
        <Row label="함께 확인하면 좋은 점">
          <InsightText value={insights} pick={(i) => i.checks} />
        </Row>
        <Row label="손님이 고른 키워드 TOP 5">
          {side.topKeywords.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {side.topKeywords.map((k, i) => (
                <li key={k} className="flex gap-2">
                  <span className={`font-bold ${t.star}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{k}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-off-text">키워드 정보 없음</p>
          )}
        </Row>
        <Row label="플레이스 활용 현황">
          <ul className="flex flex-col gap-1.5">
            {side.status.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span>{s.label}</span>
                <Pill state={s.state} />
              </li>
            ))}
            {extra.map((e) => (
              <li key={e.item} className="flex items-center justify-between gap-3">
                <span>{e.item}</span>
                <span className="text-[13px] font-bold">{e.value}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3">
              <span>인스타그램</span>
              <Pill state={snsState(side.sns.instagram)} />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>네이버 블로그</span>
              <Pill state={snsState(side.sns.blog)} />
            </li>
          </ul>
        </Row>
      </div>
    </section>
  );
}

function DiffCard({ tone, items }: { tone: Tone; items: Difference[] }) {
  const t = TONE[tone];
  const otherLabel = tone === "mine" ? "경쟁사" : "우리 가게";
  return (
    <section className="rounded-card bg-card px-[17px] py-[13px]">
      <div className="flex items-center gap-2.5">
        <span className={`inline-flex h-[25px] shrink-0 items-center rounded-full px-3 text-xs font-bold ${t.chip}`}>{t.label}</span>
        <h3 className="break-keep text-base font-bold">
          {otherLabel}보다 더 많거나 있는 항목 {items.length}개
        </h3>
      </div>
      {items.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-0.5 px-1.5 text-[13px] text-muted-foreground">
          {items.map((d) => (
            <li key={d.item}>
              {d.item} {tone === "mine" ? d.mine : d.other}{" "}
              <span className="text-off-text">
                ({otherLabel} {tone === "mine" ? d.other : d.mine})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 px-1.5 text-[13px] text-off-text">해당하는 항목이 없어요</p>
      )}
    </section>
  );
}

export function CompareView({ view }: { view: CompareViewModel }) {
  const { mine, other, numbers, differences } = view;
  const amenity = numbers.rows.find((r) => r.item === "편의시설");
  const placeId = encodeURIComponent(mine.store.placeId);

  return (
    <>
      <Link href={`/result/${placeId}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> 우리 가게 분석으로 돌아가기
      </Link>
      <h1 className="mt-3 break-keep text-[26px] font-bold leading-[1.45] sm:text-[32px]">우리 가게와 경쟁사를 비교해봤어요!</h1>

      <div className="mt-3 grid grid-cols-1 gap-[23px] lg:grid-cols-2">
        <SideCard side={mine} tone="mine" extra={amenity ? [{ item: "편의시설", value: amenity.mine }] : []} />
        <SideCard side={other} tone="other" extra={amenity ? [{ item: "편의시설", value: amenity.top }] : []} />
      </div>
      <p className="mt-2 flex items-center justify-end gap-1 text-xs font-bold text-primary">
        <ChevronsUpDown className="size-3.5" aria-hidden /> 두 카드에서 각각 스크롤해보세요
      </p>

      <h2 className="mt-1 text-xl font-bold">두 가게의 차이</h2>
      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DiffCard tone="mine" items={differences.mine} />
        <DiffCard tone="other" items={differences.other} />
      </div>
      <p className="mt-2 break-keep text-xs text-off-text">
        같은 항목의 값만 나란히 놓았어요. 어떤 차이가 중요한지는 사장님이 판단해 주세요. 현재 네이버 플레이스에 공개된 정보를 기준으로 했어요.
      </p>

      <div className="mt-5 flex flex-col items-center gap-2">
        <Link
          href={`/consult/${placeId}?with=${encodeURIComponent(other.store.placeId)}`}
          className="inline-flex h-[60px] w-[240px] items-center justify-center gap-1 rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110"
        >
          대화 시작하기 <ArrowDown className="size-[18px]" aria-hidden />
        </Link>
        <Link href={`/compare/${placeId}`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary">
          다른 가게와 비교하기
        </Link>
      </div>
    </>
  );
}
