import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "운빨 실험실 | 오늘, 확률이 내 편일까?",
  description:
    "로또 6/45와 즉석김밥1000으로 오늘의 순수한 운을 시험하는 무료 확률 게임 아케이드입니다.",
  applicationName: "운빨 실험실",
  keywords: ["운빨 테스트", "로또 게임", "즉석복권", "확률 게임"],
  openGraph: {
    title: "운빨 실험실",
    description: "오늘, 확률이 내 편일까? 두 가지 운빨 게임에 도전해보세요.",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "운빨 실험실",
    description: "로또와 즉석김밥으로 시험하는 오늘의 순수한 운.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f1e8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
