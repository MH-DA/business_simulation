import Link from "next/link";
import { SERVICE_NAME } from "@/lib/config";

// 모든 화면 공통 머리글 (Figma: 왼쪽 로고, 오른쪽 로그인 / 회원가입 또는 "○○ 님")
// 로그인 기능은 아직 없어서 오른쪽은 안내 문구로만 둔다.
export function SiteHeader({ userName }: { userName?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 pb-4 pt-8 sm:px-0">
      <Link href="/" className="flex items-center gap-1.5" aria-label={`${SERVICE_NAME} 처음으로`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/logo.png" alt="" width={42} height={42} className="size-[42px]" />
        <span className="font-logo text-[22px] leading-none text-foreground">{SERVICE_NAME}</span>
      </Link>
      <span className="text-base font-medium text-muted-foreground">{userName ? `${userName} 님` : "로그인 / 회원가입"}</span>
    </header>
  );
}

// 시안의 큰 둥근 배경 패널 (1280 × 752, 둥글기 90px)
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-0`}>
      <div className={`rounded-[40px] bg-panel px-5 py-10 sm:rounded-panel sm:px-[86px] sm:py-14 ${className}`}>{children}</div>
    </main>
  );
}
