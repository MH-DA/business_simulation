"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_PLACE_ID } from "@/lib/config";

// 링크에서 플레이스 매장 번호를 찾는다. naver.me 단축 링크는 서버에서 풀어야 해서
// 3단계(/api/analyze) 전까지는 시연용 매장으로 연결한다.
const PLACE_ID_RE = /\/(?:place|restaurant|cafe|hairshop|hospital|accommodation|nailshop)\/(\d{5,})/;

export function parsePlaceLink(raw: string): { ok: true; placeId: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) return { ok: false, message: "네이버 플레이스 링크를 붙여넣어 주세요." };
  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return { ok: false, message: "링크 형식이 아니에요. 네이버 지도에서 복사한 링크를 그대로 붙여넣어 주세요." };
  }
  const host = url.hostname;
  if (!/(^|\.)naver\.(com|me)$/.test(host)) {
    return { ok: false, message: "네이버 플레이스 링크만 분석할 수 있어요." };
  }
  const match = decodeURIComponent(url.pathname + url.search).match(PLACE_ID_RE);
  return { ok: true, placeId: match ? match[1] : DEMO_PLACE_ID };
}

export function StartForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = parsePlaceLink(value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // 3단계 전까지는 jobId 자리에 매장 번호를 그대로 넘긴다.
    router.push(`/analyzing/${result.placeId}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="w-full max-w-[480px] rounded-3xl border border-line bg-card px-6 pt-6 pb-6 text-left"
    >
      <label htmlFor="place-url" className="text-sm font-semibold text-ink">
        네이버 플레이스 URL
      </label>
      <input
        id="place-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        placeholder="네이버 플레이스 링크를 붙여넣어 주세요."
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "place-url-error" : undefined}
        className="mt-3 w-full rounded-xl border border-line bg-page px-4 py-3.5 text-[15px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      {error && (
        <p id="place-url-error" role="alert" className="mt-2 text-sm text-[#b23a3a]">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="mt-4 w-full rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        우리 가게 분석하기
      </button>
    </form>
  );
}
