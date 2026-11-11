import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/session-token";

// Figma 02 로그인. ?next= 로 로그인 뒤 돌아갈 화면을 받는다 (우리 사이트 안 경로만).
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <SiteHeader />
      <Panel className="flex min-h-[720px] items-center justify-center">
        <LoginForm next={next} />
      </Panel>
    </>
  );
}
