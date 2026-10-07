"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 2단계: 어떤 링크든 샘플 결과로 이동한다. 3단계에서 /api/analyze 호출로 바뀐다.
export function StartForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <form
      className="rounded-card border bg-card p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/result/sample-gym-001");
      }}
    >
      <label htmlFor="place-url" className="text-sm font-semibold">
        네이버 플레이스 URL
      </label>
      <input
        id="place-url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="네이버 플레이스 링크를 붙여넣어 주세요."
        className="mt-3 h-[60px] w-full rounded-xl border bg-muted px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        className="mt-4 h-[58px] w-full rounded-xl bg-primary text-base font-bold text-primary-foreground transition hover:opacity-90"
      >
        우리 가게 분석하기
      </button>
    </form>
  );
}
