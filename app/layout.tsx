import type { Metadata } from "next";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SERVICE_NAME} · 사장님 AI 마케팅 도우미`,
  description: SERVICE_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
