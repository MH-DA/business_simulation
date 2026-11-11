import Link from "next/link";

// Figma 01 · 비로그인 블러: 분석 결과를 흐리게 보여주고 로그인을 안내한다.
// 뒤의 화면은 눌리거나 읽히지 않게 막는다(inert). 결과는 공개 가게 정보라 흐린 화면에 그대로 둔다.
export function GuestGate({ next, children }: { next: string; children: React.ReactNode }) {
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-md" aria-hidden inert>
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-24 sm:pt-40">
        <section role="dialog" aria-labelledby="guest-gate-title" className="w-full max-w-[500px] rounded-[28px] bg-card px-8 py-10 text-center shadow-lg">
          <h2 id="guest-gate-title" className="text-[24px] font-bold">
            우리 가게 분석 결과가 준비됐어요!
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            로그인하고 우리 가게의 분석 결과와
            <br />
            맞춤 마케팅 제안을 확인해보세요.
          </p>
          <Link
            href={`/login${q}`}
            className="mt-7 flex h-[56px] items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110"
          >
            로그인하고 분석 결과 보기
          </Link>
          <p className="mt-5 text-[13px] text-muted-foreground">
            아직 계정이 없으신가요?{" "}
            <Link href={`/signup${q}`} className="font-bold text-primary">
              회원가입
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
