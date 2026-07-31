import type { Metadata, Viewport } from "next";
import "../../app/globals.css";

const title = "운빨 실험실 | 코인으로 시험하는 오늘의 운";
const description =
  "100만 C로 시작해 로또, 즉석김밥, 종이뽑기판, 랜덤 주식, 행운 경마, AI 가위바위보와 타이밍 게임으로 오늘의 운을 시험하는 코인 아케이드입니다.";
const siteUrl = process.env.PAGES_SITE_URL ?? "https://lotto.yeseo.im";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "운빨 실험실",
  keywords: [
    "운빨 게임",
    "코인 게임",
    "로또 게임",
    "즉석복권",
    "종이뽑기",
    "모의 주식",
    "경마 게임",
    "가위바위보 게임",
    "타이밍 게임",
  ],
  openGraph: {
    title: "운빨 실험실",
    description: "코인으로 시험하는 오늘의 운",
    locale: "ko_KR",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/og-seven-games.png",
        width: 1731,
        height: 908,
        alt: "로또, 즉석김밥, 종이뽑기판, 주식, 경마, 가위바위보와 타이밍 게임이 담긴 운빨 실험실",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "운빨 실험실",
    description: "코인으로 시험하는 오늘의 운",
    images: ["/og-seven-games.png"],
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
