import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Pretendard 가변 글꼴 (app/fonts/README.txt 참고)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export const metadata: Metadata = {
  title: "사장님 AI 마케팅 도우미",
  description: "네이버 플레이스 링크로 가게를 살펴보고, 지금 필요한 마케팅을 함께 찾아드려요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
