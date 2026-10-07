"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = ["가게 정보를 모으는 중", "리뷰 키워드를 살펴보는 중", "개선 포인트를 찾는 중"];
const STEP_MS = 1100;

// 분석 중 화면 (시안 없음 — PROJECT.md 3장 구성 기준)
// 3단계에서 GET /api/jobs/[jobId] 폴링으로 바꾼다. 지금은 단계를 순서대로 보여준 뒤 결과로 이동한다.
export function AnalyzingProgress() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step < STEPS.length) {
      const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
      return () => clearTimeout(t);
    }
    router.replace(`/result/${jobId}`);
  }, [step, jobId, router]);

  return (
    <div className="w-full max-w-[480px]">
      <ol className="space-y-3" aria-live="polite">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "active" : "wait";
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-2xl border px-5 py-4 transition-colors ${
                state === "wait" ? "border-line bg-card text-faint" : "border-line bg-card text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex size-6 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "bg-brand text-white"
                    : state === "active"
                      ? "border-2 border-brand text-brand motion-safe:animate-pulse"
                      : "border border-line text-faint"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className="text-[15px]">{label}</span>
              <span className="sr-only">{state === "done" ? "완료" : state === "active" ? "진행 중" : "대기"}</span>
            </li>
          );
        })}
      </ol>

      <aside className="mt-8 rounded-2xl bg-mint px-6 py-5 text-left">
        <p className="text-xs font-semibold text-brand">알고 계셨나요?</p>
        <p className="mt-2 text-[15px] leading-7 text-ink">
          처음 가보는 가게를 고를 때, 손님은 별점보다 리뷰 수를 더 믿는 경향이 있어요.
        </p>
        <p className="mt-1 text-xs text-muted">리뷰 수 휴리스틱 · 근거 강함</p>
      </aside>
    </div>
  );
}
