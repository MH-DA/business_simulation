"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// 비교할 가게 URL 입력. 수집 전 가게면 안내하고 건너뛰기를 권한다.
export function CompetitorForm({ placeId }: { placeId: string }) {
  const router = useRouter();
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
    try {
      const res = await fetch("/api/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, url }),
      });
      const data = (await res.json()) as { status?: string; competitorId?: string; error?: string };
      if (res.ok && data.competitorId) {
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

  return (
    <form onSubmit={submit} noValidate className="flex flex-col items-center">
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
        placeholder="비교할 가게의 네이버 플레이스 URL을 입력하세요."
        className={`h-[76px] w-full rounded-full border bg-card px-8 text-lg shadow-[0_8px_24px_rgba(36,36,36,0.06)] outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      <div id="competitor-msg" role="alert" className="mt-3 min-h-6 text-sm">
        {error && <p className="text-destructive">{error}</p>}
        {notReady && (
          <p className="break-keep text-muted-foreground">
            이 가게는 아직 정보를 모으지 못했어요. 요청은 접수했으니, 지금은 건너뛰고 상담을 먼저 시작해 보세요.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href={skipHref}
          className="inline-flex h-[60px] w-[200px] items-center justify-center rounded-xl border border-input bg-card text-[17px] font-bold text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          건너뛰기
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-[60px] w-[240px] items-center justify-center gap-2 rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "확인하는 중..." : "나란히 비교하기"}
          {!loading && <ArrowRight className="size-5" aria-hidden />}
        </button>
      </div>
    </form>
  );
}
