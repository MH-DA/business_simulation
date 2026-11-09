"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UrlGuideDialog } from "./UrlGuideDialog";

const MIN_DWELL_MS = 1500; // "분석 중" 화면이 깜빡이고 지나가지 않게 잠깐 보여준다

// Figma 05. 경쟁사 분석 URL → 05. 경쟁사 분석 중. 수집 전 가게면 안내하고 건너뛰기를 권한다.
export function CompetitorForm({ placeId }: { placeId: string }) {
  const router = useRouter();
  const guideRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const skipHref = `/consult/${encodeURIComponent(placeId)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotReady(false);
    if (!url.trim()) return setError("비교할 가게의 네이버 플레이스 주소를 입력해 주세요.");
    setLoading(true);
    const started = Date.now();
    try {
      const res = await fetch("/api/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, url }),
      });
      const data = (await res.json()) as { status?: string; competitorId?: string; error?: string };
      if (res.ok && data.competitorId) {
        await new Promise((r) => setTimeout(r, Math.max(0, MIN_DWELL_MS - (Date.now() - started))));
        router.push(`/compare/${encodeURIComponent(placeId)}/${encodeURIComponent(data.competitorId)}`);
        return;
      }
      if (data.status === "needs_collection") setNotReady(true);
      else setError(data.error ?? "네이버 플레이스 주소가 올바르지 않습니다.");
    } catch {
      setError("서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center" aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/mascot.png" alt="" width={240} height={200} className="w-[200px] animate-bounce [animation-duration:1.6s] sm:w-[240px]" />
        <h1 className="mt-14 text-[22px] font-bold">우리 가게와 경쟁사를 비교하고 있어요!</h1>
        <p className="mt-1 text-base text-muted-foreground">잠시만 기다려주세요</p>
      </section>
    );
  }

  return (
    <>
      <h1 className="break-keep text-[30px] font-bold leading-[1.4] sm:text-[38px]">어떤 가게와 비교해볼까요?</h1>
      <p className="mt-3 break-keep text-base text-muted-foreground sm:text-lg">
        비교하고 싶은 경쟁사의 네이버 플레이스 URL을 입력해주세요.
      </p>
      <form onSubmit={submit} noValidate className="mt-14 flex w-full max-w-[660px] flex-col items-center">
        <label htmlFor="competitor-url" className="sr-only">
          비교할 가게의 네이버 플레이스 URL
        </label>
        <input
          id="competitor-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
            setNotReady(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby="competitor-msg"
          placeholder="네이버 플레이스 URL을 입력하세요."
          className={`h-[76px] w-full rounded-full border bg-card px-8 text-lg shadow-[0_8px_24px_rgba(36,36,36,0.06)] outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 ${
            error ? "border-destructive" : "border-input"
          }`}
        />
        <div id="competitor-msg" role="alert" className="mt-3 min-h-6 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          {notReady && (
            <p className="break-keep text-muted-foreground">
              이 가게는 아직 정보를 모으지 못했어요. 요청은 접수했으니, 지금은 건너뛰고 다음 단계로 가 보세요.
            </p>
          )}
        </div>
        <button
          type="submit"
          className="mt-6 inline-flex h-[60px] w-[268px] items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110"
        >
          경쟁사 분석하기
        </button>
        <Link href={skipHref} className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-primary">
          비교 없이 다음 단계로
        </Link>
        <button
          type="button"
          onClick={() => guideRef.current?.showModal()}
          className="mt-14 text-sm text-primary underline underline-offset-4"
        >
          네이버 플레이스 URL 찾는 방법
        </button>
      </form>
      <UrlGuideDialog ref={guideRef} />
    </>
  );
}
