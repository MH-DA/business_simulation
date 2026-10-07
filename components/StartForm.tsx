"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "분석을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        setLoading(false);
        return;
      }
      router.push(`/analyzing/${data.jobId}`);
    } catch {
      setError("서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  return (
    <form className="rounded-card border bg-card p-6 sm:p-8" onSubmit={submit} noValidate>
      <label htmlFor="place-url" className="text-sm font-semibold">
        네이버 플레이스 URL
      </label>
      <input
        id="place-url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "place-url-error" : undefined}
        placeholder="네이버 플레이스 링크를 붙여넣어 주세요."
        className="mt-3 h-[60px] w-full rounded-xl border bg-muted px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error && (
        <p id="place-url-error" role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 h-[58px] w-full rounded-xl bg-primary text-base font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "확인하는 중..." : "우리 가게 분석하기"}
      </button>
    </form>
  );
}
