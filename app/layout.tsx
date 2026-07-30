import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "운빨 실험실 | 코인으로 시험하는 오늘의 운";
const description =
  "100만 C로 시작해 로또, 즉석김밥, 종이뽑기판, 랜덤 주식과 행운 경마장에서 오늘의 운을 시험하는 코인 아케이드입니다.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const requestHost = forwardedHost ?? requestHeaders.get("host");
  const safeHost =
    requestHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(requestHost)
      ? requestHost
      : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : safeHost.startsWith("localhost")
        ? "http"
        : "https";
  const origin = `${protocol}://${safeHost}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
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
    ],
    openGraph: {
      title: "운빨 실험실",
      description: "코인으로 시험하는 오늘의 운",
      locale: "ko_KR",
      type: "website",
      url: origin,
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "로또, 즉석김밥, 종이뽑기판, 주식과 경마 게임이 담긴 운빨 실험실",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "운빨 실험실",
      description: "코인으로 시험하는 오늘의 운",
      images: [socialImage],
    },
  };
}

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
