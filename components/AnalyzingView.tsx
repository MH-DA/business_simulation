"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Job } from "@/types";
import { LandingHeader } from "./SiteHeader";
import { NeedsCollection } from "./NeedsCollection";

const STEPS = ["가게 정보를 확인하고 있어요", "리뷰 키워드를 살펴보고 있어요", "분석 결과를 정리하고 있어요"];
const MIN_DWELL_MS = 1500; // 너무 빨리 넘어가서 화면이 깜빡이지 않게 잠깐 보여준다

export function AnalyzingView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let stop = false;
    const started = Date.now();
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 500);

    async function poll() {
      while (!stop) {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" }).catch(() => null);
        if (stop) return;
        if (res?.status === 404) return setMissing(true);
        if (res?.ok) {
          const j = (await res.json()) as Job;
          if (j.status === "done") {
            const wait = Math.max(0, MIN_DWELL_MS - (Date.now() - started));
            await new Promise((r) => setTimeout(r, wait));
            if (!stop) router.replace(`/result/${j.placeId}`);
            return;
          }
          if (j.status === "needs_collection" || j.status === "failed") return setJob(j);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    poll();
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [jobId, router]);

  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-[640px] flex-1 px-6 pb-16 pt-10">
        {job?.status === "needs_collection" ? (
          <NeedsCollection />
        ) : missing || job?.status === "failed" ? (
          <section className="rounded-card border bg-card p-8 text-center">
            <h1 className="text-2xl font-bold">분석을 이어가지 못했어요</h1>
            <p className="mt-3 text-muted-foreground">{job?.error ?? "작업을 찾을 수 없어요. 처음부터 다시 시도해 주세요."}</p>
            <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-lg bg-primary px-6 font-bold text-primary-foreground">
              처음으로 돌아가기
            </Link>
          </section>
        ) : (
          <section className="rounded-card border bg-card p-8 text-center" aria-live="polite">
            <h1 className="text-2xl font-bold">우리 가게를 살펴보고 있어요</h1>
            <ol className="mx-auto mt-6 flex max-w-xs flex-col gap-3 text-left">
              {STEPS.map((s, i) => (
                <li key={s} className={i <= step ? "text-foreground" : "text-muted-foreground/50"}>
                  {i < step ? "✓ " : i === step ? "• " : "  "}
                  {s}
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </>
  );
}
