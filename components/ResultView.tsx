"use client";

import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, X } from "lucide-react";
import { hasIntro } from "@/lib/checked";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Insights } from "@/lib/insights";
import type { ResultViewModel, StatusItem } from "@/lib/result-view";

// Figma 04 · 가게 분석 결과 (현황 / 더보기 / 리뷰 / 외부채널, 제안). 다음 단계는 경쟁 가게 비교(/compare).

const SLIDES = ["현황", "리뷰", "마케팅 자산·제안"] as const;

const fmt = (n?: number) => (n === undefined ? "-" : n.toLocaleString("ko-KR"));

export function ResultView({ view }: { view: ResultViewModel }) {
  const [slide, setSlide] = useState(0);
  const [insights, setInsights] = useState<Insights | null>(null);
  const introRef = useRef<HTMLDialogElement>(null);
  const { store } = view;

  useEffect(() => {
    let alive = true;
    fetch(`/api/insights/${encodeURIComponent(store.placeId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Insights>) : null))
      .then((d) => alive && setInsights(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [store.placeId]);

  return (
    <>
      <h1 className="break-keep text-[26px] font-bold leading-[1.45] sm:text-[32px]">우리 가게 분석을 완료했어요!</h1>
      {view.isDemo && (
        <p className="mt-3 rounded-tile bg-card px-4 py-3 text-sm text-muted-foreground">
          아직 이 가게의 수집 정보가 없어서 샘플 가게 데이터로 화면을 보여드리고 있어요.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-[15px] lg:grid-cols-[410px_minmax(0,1fr)]">
        {/* 왼쪽: 기본 가게 정보 + 키워드·소개글 */}
        <div className="flex flex-col gap-1.5">
          <section className="rounded-card border bg-card px-[26px] py-5">
            <p className="text-sm font-bold text-primary">기본 가게 정보</p>
            <div className="mt-0.5 flex items-start justify-between gap-3">
              <h2 className="break-keep text-[28px] font-bold leading-[1.4] sm:text-[32px]">{store.name}</h2>
              {store.rating != null && <p className="mt-3 shrink-0 text-[17px] font-bold text-star">★ {store.rating.toFixed(1)}</p>}
            </div>
            <p className="text-base text-muted-foreground">{store.category.split(",").join(" · ")}</p>
            <ul className="mt-2 flex flex-col gap-0.5 text-[15px] leading-[1.55] text-muted-foreground">
              <InfoRow icon={MapPin} text={store.address ?? "주소 확인 전"} />
              <InfoRow icon={CalendarDays} text={store.closedDays ?? "휴무일 확인 전"} />
              <InfoRow icon={Clock} text={store.openHours ? `영업시간 ${store.openHours}` : "영업시간 확인 전"} />
            </ul>
          </section>

          <section className="flex-1 rounded-card border bg-card px-[26px] py-5">
            <p className="text-sm font-bold text-primary">현재 확인된 키워드</p>
            <ul className="mt-2 flex gap-2">
              {view.chips.map((c) => (
                <li key={c} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-2xl bg-secondary px-2 text-[13px] text-primary">
                  <span className="truncate">{c}</span>
                </li>
              ))}
              {view.chips.length === 0 && <li className="text-sm text-muted-foreground">확인된 키워드가 아직 없어요</li>}
            </ul>
            <div className="mt-[52px] flex items-center justify-between">
              <p className="text-sm font-bold text-primary">현재 가게 소개글</p>
              {store.intro && (
                <button type="button" onClick={() => introRef.current?.showModal()} className="text-sm font-light text-primary underline underline-offset-2">
                  더보기
                </button>
              )}
            </div>
            <p className="mt-2 line-clamp-3 text-[15px] leading-[1.55] text-muted-foreground">
              {hasIntro(store) === undefined ? "소개글은 확인 전이에요." : store.intro?.trim() || "등록된 소개글이 없어요."}
            </p>
          </section>
        </div>

        {/* 오른쪽: 슬라이드 패널 */}
        <section className="flex min-h-[495px] flex-col rounded-card border bg-card px-6 pb-5 pt-6" aria-roledescription="슬라이드" aria-label={`${SLIDES[slide]} (${slide + 1}/${SLIDES.length})`}>
          <div className="flex-1">
            {slide === 0 && <StatusSlide items={view.status} />}
            {slide === 1 && <ReviewSlide view={view} insights={insights} />}
            {slide === 2 && <AssetSlide items={view.assets} insights={insights} />}
          </div>
          {slide === SLIDES.length - 1 && (
            <p className="mt-4 text-center text-xs text-primary">비교해 보고 싶은 가게가 있다면, 다음 단계에서 나란히 볼 수 있어요!</p>
          )}
          <nav className="mt-4 flex items-center justify-center gap-3" aria-label="분석 결과 넘기기">
            <button type="button" onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} aria-label="이전" className="text-muted-foreground disabled:opacity-30">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            {SLIDES.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={name}
                aria-current={i === slide}
                className={`size-[7px] rounded-full ${i === slide ? "bg-primary" : "bg-off-pill"}`}
              />
            ))}
            <button
              type="button"
              onClick={() => setSlide((s) => Math.min(SLIDES.length - 1, s + 1))}
              disabled={slide === SLIDES.length - 1}
              aria-label="다음"
              className="text-muted-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </nav>
        </section>
      </div>

      <div className="mt-11 flex justify-center">
        <Link
          href={`/compare/${encodeURIComponent(store.placeId)}`}
          className="inline-flex h-[60px] w-[240px] items-center justify-center gap-1 rounded-tile bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110"
        >
          다음 단계로 <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
      </div>

      <dialog
        ref={introRef}
        aria-labelledby="intro-title"
        className="m-auto w-[min(520px,calc(100%-32px))] rounded-card bg-card p-8 shadow-xl backdrop:bg-black/30"
        onClick={(e) => e.target === introRef.current && introRef.current?.close()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="intro-title" className="text-xl font-bold">
              우리 가게 소개글
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">네이버 플레이스에 등록된 소개글이에요.</p>
          </div>
          <button type="button" onClick={() => introRef.current?.close()} aria-label="닫기" className="text-muted-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mt-6 font-bold">{store.name}</p>
        <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{store.intro}</p>
      </dialog>
    </>
  );
}

function InfoRow({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-[18px] shrink-0 text-[#c4cbd0]" aria-hidden />
      {text}
    </li>
  );
}

function SlideTitle({ title, note }: { title: string; note?: string }) {
  return (
    <header>
      <h3 className="text-xl font-bold leading-[1.5]">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-off-text">{note}</p>}
    </header>
  );
}

const PUBLIC_NOTE = "현재 네이버 플레이스에 공개된 정보를 기준으로 분석했으며, 실제 가게 상황과 다를 수 있어요.";

function StatusCard({ item }: { item: StatusItem }) {
  const on = item.state === "on";
  return (
    <li className={`flex flex-col gap-3 rounded-tile border px-[18px] pb-3.5 pt-[17px] ${on ? "border-on-border bg-on-bg" : "border-off-border bg-off-bg"}`}>
      <div className="flex h-7 items-center justify-between gap-2">
        <p className="text-base font-bold">{item.label}</p>
        <span
          className={`flex h-[26px] w-14 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            on ? "bg-primary text-white" : "bg-off-pill text-off-pill-text"
          }`}
        >
          {item.state === "on" ? "ON" : item.state === "off" ? "OFF" : "확인 전"}
        </span>
      </div>
      <p className={`text-xs ${on ? "text-on-text" : "text-off-text"}`}>{item.text}</p>
    </li>
  );
}

function StatusSlide({ items }: { items: StatusItem[] }) {
  return (
    <>
      <SlideTitle title="우리 가게의 플레이스 활용 현황" note={PUBLIC_NOTE} />
      <ul className="mt-5 grid gap-[14px] sm:grid-cols-2">
        {items.map((it) => (
          <StatusCard key={it.label} item={it} />
        ))}
      </ul>
    </>
  );
}

function Pending({ text = "AI가 리뷰를 읽고 정리하고 있어요…" }: { text?: string }) {
  return <p className="animate-pulse text-[13px] text-off-text">{text}</p>;
}

function ReviewSlide({ view, insights }: { view: ResultViewModel; insights: Insights | null }) {
  const { review } = view;
  return (
    <>
      <SlideTitle title="우리 가게의 리뷰 한눈에 보기" />
      <p className="mt-1 text-[13px] text-muted-foreground">
        방문자 리뷰 <b className="text-primary">{fmt(review.visitorCount)}개</b>
        <span className="ml-2">
          블로그 리뷰 <b className="text-primary">{fmt(review.blogCount)}개</b>
        </span>
      </p>

      <div className="mt-3 rounded-tile bg-on-bg px-4 py-3.5">
        {insights ? <p className="text-[15px] leading-relaxed">{insights.summary}</p> : <Pending />}
        {insights && insights.hashtags.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {insights.hashtags.map((h) => (
              <li key={h} className="rounded-full bg-card px-3 py-1 text-xs text-primary">
                #{h}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-[1fr_1.35fr]">
        <div className="rounded-tile border px-4 py-3.5">
          <p className="text-base font-bold">이런 점이 좋아요 TOP 5</p>
          <ol className="mt-2 flex flex-col gap-[11px]">
            {review.topKeywords.map((k, i) => (
              <li key={k.keyword} className="flex gap-3 text-sm">
                <span className="font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate">{k.keyword}</span>
              </li>
            ))}
            {review.topKeywords.length === 0 && <li className="text-sm text-muted-foreground">키워드 정보가 아직 없어요</li>}
          </ol>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="flex-1 rounded-tile bg-on-bg px-4 py-3.5">
            <p className="text-base font-bold text-primary">고객이 좋아하는 점</p>
            <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{insights ? insights.likes : <Pending />}</div>
          </div>
          <div className="flex-1 rounded-tile bg-info px-4 py-3.5">
            <p className="text-base font-bold text-info-foreground">함께 확인하면 좋은 점</p>
            <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{insights ? insights.checks : <Pending />}</div>
          </div>
        </div>
      </div>

      {review.facts.length > 0 && (
        <p className="mt-3 text-xs text-off-text">
          {review.facts.map((f) => `${f.label} ${f.value}`).join(" · ")} ({review.facts[0].note})
        </p>
      )}
    </>
  );
}

function AssetSlide({ items, insights }: { items: StatusItem[]; insights: Insights | null }) {
  return (
    <>
      <SlideTitle title="우리 가게의 마케팅 자산" note={PUBLIC_NOTE} />
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const on = it.state === "on";
          return (
            <li key={it.label} className={`rounded-tile border px-[15px] py-[15px] ${on ? "border-on-border bg-on-bg" : "border-off-border bg-off-bg"}`}>
              <p className="flex items-center gap-3">
                <span className="text-[15px] font-bold">{it.label}</span>
                <span className={`text-[11px] ${on ? "font-bold text-primary" : "text-off-pill-text"}`}>
                  {on ? "등록됨" : it.state === "off" ? "등록 정보 없음" : "확인 전"}
                </span>
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{it.text}</p>
            </li>
          );
        })}
      </ul>

      <h4 className="mt-8 text-xl font-bold">PLACEMENT의 제안</h4>
      <div className="mt-2 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/mascot.png" alt="" width={166} height={130} className="hidden shrink-0 sm:block" />
        <div className="relative flex-1 rounded-[20px] bg-on-bg px-[18px] py-4">
          <p className="text-[13px] font-bold text-primary">사장님, 이런 매력을 알려보면 어떨까요?</p>
          {insights?.proposal ? (
            <>
              <p className="mt-1.5 text-lg font-bold">“{insights.proposal.headline}”</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{insights.proposal.body}</p>
            </>
          ) : insights ? (
            <p className="mt-2 text-xs text-muted-foreground">제안 문구는 AI 연결 후 보여드려요. 아래 상담에서 함께 만들어 볼 수 있어요.</p>
          ) : (
            <div className="mt-2">
              <Pending text="가게에 맞는 문구를 고르고 있어요…" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
