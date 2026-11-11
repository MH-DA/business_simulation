// 시안의 큰 둥근 배경 패널 (1280 × 752, 둥글기 90px)
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-0`}>
      <div className={`rounded-[40px] bg-panel px-5 py-10 sm:rounded-panel sm:px-[86px] sm:py-14 ${className}`}>{children}</div>
    </main>
  );
}
