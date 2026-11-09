"use client";

import { X } from "lucide-react";
import { forwardRef } from "react";

const GUIDE = [
  { title: "네이버에서 가게를 검색해요", body: "가게 이름과 지역을 함께 검색하면 더 쉽게 찾을 수 있어요." },
  { title: "가게의 플레이스 상세 페이지를 열어요", body: "검색 결과에서 주소와 전화번호를 확인하고 가게를 선택해 주세요." },
  { title: "주소창의 URL 또는 공유 링크를 복사해요", body: "이 화면으로 돌아와 입력창에 붙여 넣으면 준비가 끝나요." },
];

// "네이버 플레이스 URL 찾는 방법" 팝업. 시작 화면과 경쟁 가게 URL 입력 화면이 함께 쓴다.
export const UrlGuideDialog = forwardRef<HTMLDialogElement>(function UrlGuideDialog(_props, ref) {
  const close = () => (ref && "current" in ref ? ref.current?.close() : undefined);
  return (
    <dialog
      ref={ref}
      aria-labelledby="guide-title"
      className="m-auto w-[min(560px,calc(100%-32px))] rounded-card bg-card p-8 text-left shadow-xl backdrop:bg-black/30"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="guide-title" className="text-xl font-bold">
            네이버 플레이스 URL 찾는 방법
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">가게의 상세 페이지 주소를 복사해 주세요.</p>
        </div>
        <button type="button" onClick={close} aria-label="닫기" className="text-muted-foreground">
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
  );
});
