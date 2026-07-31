import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "운빨 실험실 | 황야의 행운을 건 프런티어 아케이드";
const description =
  "100만 C를 들고 황야의 살롱에 입장해 로또, 즉석김밥, 종이뽑기판, 랜덤 주식, 행운 경마, AI 가위바위보와 타이밍 결투를 즐기는 서부극풍 코인 아케이드입니다.";

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
  const socialImage = new URL("/og-western.png", origin).toString();

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
      "가위바위보 게임",
      "타이밍 게임",
    ],
    openGraph: {
      title: "운빨 실험실 · FRONTIER LUCK CLUB",
      description: "운을 걸고, 황야의 전설이 되세요.",
      locale: "ko_KR",
      type: "website",
      url: origin,
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "황야의 살롱에서 일곱 가지 행운 게임을 즐기는 운빨 실험실",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "운빨 실험실 · FRONTIER LUCK CLUB",
      description: "운을 걸고, 황야의 전설이 되세요.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1a100b",
  colorScheme: "dark",
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
