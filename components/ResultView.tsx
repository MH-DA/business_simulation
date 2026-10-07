"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ResultViewModel } from "@/lib/result-view";
import { ChatPanel } from "./ChatPanel";
import { InsightCard } from "./InsightCard";
import { CompactStoreCard, StoreCard } from "./StoreCard";

export function ResultView({ view }: { view: ResultViewModel }) {
  const fullRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  // 큰 가게 카드가 화면 위로 지나가면 작은 카드를 위에 고정해 보여준다.
  useEffect(() => {
    const el = fullRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function goChat() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("chat")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <>
      <div
        className={`fixed inset-x-0 top-0 z-20 px-6 pt-3 transition duration-200 ${
          compact ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        inert={!compact}
      >
        <div className="mx-auto max-w-[960px]">
          <CompactStoreCard store={view.store} chips={view.chips} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1120px] px-6 py-10">
        <h1 className="text-[32px] font-bold">우리 가게 분석이 끝났어요</h1>
        <p className="mt-2 text-muted-foreground">
          가게의 강점과 개선 기회를 확인하고, 고민을 함께 이야기해보세요.
        </p>

        {view.isDemo && (
          <p className="mt-4 rounded-tile bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            아직 이 가게의 수집 정보가 없어서 샘플 가게 데이터로 화면을 보여드리고 있어요.
          </p>
        )}

        <div ref={fullRef} className="mt-8">
          <StoreCard store={view.store} chips={view.chips} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <InsightCard title="자주 언급되는 강점" lines={view.strengths} />
          <InsightCard title="자주 언급되는 불편 사항" lines={view.concerns} note={view.concernsNote} />
        </div>

        <section className="mt-6 rounded-card border bg-card p-6 sm:p-8">
          <h3 className="text-xl font-bold">리뷰 분석</h3>
          <p className="mt-1 text-sm text-muted-foreground">리뷰에서 읽히는 우리 가게의 경험</p>
          <p className="mt-4 leading-relaxed">{view.reviewText}</p>
          <p className="mt-4 text-xs text-muted-foreground">{view.reviewNote}</p>
        </section>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={goChat}
            className="inline-flex h-14 items-center gap-2 rounded-xl bg-primary px-8 font-bold text-primary-foreground transition hover:opacity-90"
          >
            아래로 내려 상담 시작하기 <ArrowDown className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mx-auto mt-24 max-w-[960px]">
          <ChatPanel />
        </div>
      </main>
    </>
  );
}
