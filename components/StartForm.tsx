"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const GUIDE = [
  { title: "네이버에서 우리 가게를 검색해요", body: "가게 이름과 지역을 함께 검색하면 더 쉽게 찾을 수 있어요." },
  { title: "우리 가게의 플레이스 상세 페이지를 열어요", body: "검색 결과에서 주소와 전화번호를 확인하고 우리 가게를 선택해 주세요." },
  { title: "주소창의 URL 또는 공유 링크를 복사해요", body: "시작 화면으로 돌아와 입력창에 붙여 넣으면 준비가 끝나요." },
];

export function StartForm() {
  const router = useRouter();
  const guideRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("네이버 플레이스 주소를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("네이버 플레이스 주소가 올바르지 않습니다.");
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
    <>
      <form onSubmit={submit} noValidate className="flex flex-col items-center">
        <label htmlFor="place-url" className="sr-only">
          네이버 플레이스 URL
        </label>
        <input
          id="place-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "place-url-error" : undefined}
          placeholder="네이버 플레이스 URL을 입력하세요."
          className={`h-[76px] w-full rounded-full border bg-card px-8 text-lg shadow-[0_8px_24px_rgba(36,36,36,0.06)] outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 ${
            error ? "border-destructive" : "border-input"
          }`}
        />
        <p id="place-url-error" role="alert" className="mt-3 min-h-6 text-sm text-destructive">
          {error}
        </p>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-[60px] w-[268px] items-center justify-center gap-2 rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "확인하는 중..." : "우리 가게 분석 시작하기"}
          {!loading && <ArrowRight className="size-5" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => guideRef.current?.showModal()}
          className="mt-20 text-sm text-primary underline underline-offset-4"
        >
          네이버 플레이스 URL 찾는 방법
        </button>
      </form>

      <dialog
        ref={guideRef}
        aria-labelledby="guide-title"
        className="m-auto w-[min(560px,calc(100%-32px))] rounded-card bg-card p-8 text-left shadow-xl backdrop:bg-black/30"
        onClick={(e) => e.target === guideRef.current && guideRef.current?.close()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="guide-title" className="text-xl font-bold">
              네이버 플레이스 URL 찾는 방법
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">우리 가게의 상세 페이지 주소를 복사해 주세요.</p>
          </div>
          <button type="button" onClick={() => guideRef.current?.close()} aria-label="닫기" className="text-muted-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <ol className="mt-6 flex flex-col gap-5">
          {GUIDE.map((g, i) => (
            <li key={g.title} className="flex gap-4">
              <span className="text-lg font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="font-bold">{g.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{g.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </dialog>
    </>
  );
}
