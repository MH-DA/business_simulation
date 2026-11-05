"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Job } from "@/types";
import { NeedsCollection } from "./NeedsCollection";
import { Panel, SiteHeader } from "./SiteHeader";

const MIN_DWELL_MS = 1500; // 너무 빨리 넘어가서 화면이 깜빡이지 않게 잠깐 보여준다

// Figma 03 · 시작 화면 / 분석중
export function AnalyzingView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    const started = Date.now();

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
    };
  }, [jobId, router]);

  return (
    <>
      <SiteHeader />
      <Panel className="flex min-h-[720px] flex-col items-center justify-center text-center">
        {job?.status === "needs_collection" ? (
          <NeedsCollection />
        ) : missing || job?.status === "failed" ? (
          <section className="flex flex-col items-center">
            <h1 className="text-[28px] font-bold">분석을 이어가지 못했어요</h1>
            <p className="mt-3 text-muted-foreground">{job?.error ?? "작업을 찾을 수 없어요. 처음부터 다시 시도해 주세요."}</p>
            <Link
              href="/"
              className="mt-8 inline-flex h-[60px] w-[240px] items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-primary-foreground"
            >
              처음으로 돌아가기
            </Link>
          </section>
        ) : (
          <section className="flex flex-col items-center" aria-live="polite">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/figma/mascot.png" alt="" width={166} height={130} className="animate-bounce [animation-duration:1.6s]" />
            <h1 className="mt-8 text-[32px] font-bold">잠시만 기다려주세요</h1>
            <p className="mt-3 text-lg text-muted-foreground">우리 가게를 꼼꼼히 살펴보고 있어요!</p>
          </section>
        )}
      </Panel>
    </>
  );
}
