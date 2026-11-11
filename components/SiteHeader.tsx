import Link from "next/link";
import { SERVICE_NAME } from "@/lib/config";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

// 모든 화면 공통 머리글 (Figma: 왼쪽 로고, 오른쪽 "로그인 / 회원가입" 또는 "○○ 님")
export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 pb-4 pt-8 sm:px-0">
      <Link href="/" className="flex items-center gap-1.5" aria-label={`${SERVICE_NAME} 처음으로`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/logo.png" alt="" width={42} height={42} className="size-[42px]" />
        <span className="font-logo text-[22px] leading-none text-foreground">{SERVICE_NAME}</span>
      </Link>
      {user ? (
        <div className="flex items-center gap-3 text-base font-medium">
          <span>{user.displayName} 님</span>
          <LogoutButton />
        </div>
      ) : (
        <nav className="text-base font-medium text-muted-foreground" aria-label="계정">
          <Link href="/login" className="hover:text-foreground">
            로그인
          </Link>
          <span aria-hidden> / </span>
          <Link href="/signup" className="hover:text-foreground">
            회원가입
          </Link>
        </nav>
      )}
    </header>
  );
}

// Panel 은 클라이언트 화면에서도 쓰므로 따로 둔다 (이 파일은 서버에서 로그인 정보를 읽는다)
export { Panel } from "./Panel";
