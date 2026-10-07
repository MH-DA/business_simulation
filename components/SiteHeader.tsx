import Link from "next/link";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/config";

export function LandingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-6">
      <Link href="/" className="text-lg font-bold">
        {SERVICE_NAME}
      </Link>
      <span className="hidden text-sm text-muted-foreground sm:block">{SERVICE_TAGLINE}</span>
    </header>
  );
}

export function ResultHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold">
          {SERVICE_NAME}
        </Link>
        <span className="text-sm text-muted-foreground">가게 분석 / 맞춤 상담</span>
      </div>
    </header>
  );
}
