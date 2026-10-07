import Link from "next/link";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/config";

// variant="intro": 시작·가이드 화면 (왼쪽 서비스명, 오른쪽 한 줄 소개)
// variant="app": 결과·상담 화면 (서비스명 옆에 "가게 분석 / 맞춤 상담" 경로)
export function SiteHeader({ variant = "intro" }: { variant?: "intro" | "app" }) {
  if (variant === "app") {
    return (
      <header className="mx-auto flex w-full max-w-[1120px] items-baseline gap-4 px-4 pt-7 pb-2 sm:px-6">
        <Link href="/" className="text-lg font-bold text-ink">
          {SERVICE_NAME}
        </Link>
        <nav aria-label="현재 위치" className="text-sm text-muted">
          가게 분석 <span className="px-1 text-faint">/</span> 맞춤 상담
        </nav>
      </header>
    );
  }
  return (
    <header className="mx-auto flex w-full max-w-[1000px] items-center justify-between px-4 pt-8 sm:px-6">
      <Link href="/" className="text-sm text-muted">
        {SERVICE_NAME}
      </Link>
      <p className="hidden text-sm text-muted sm:block">{SERVICE_TAGLINE}</p>
    </header>
  );
}
