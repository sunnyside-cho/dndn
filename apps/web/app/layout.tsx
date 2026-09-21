import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE } from "@/lib/site";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.baseUrl),
  title: { default: `${SITE.name} — 은퇴 전후 돈 계산`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  // 도메인 연결 전 색인 차단 (BUILD_BRIEF) — NEXT_PUBLIC_INDEXABLE=true 로 해제
  robots: SITE.indexable ? undefined : { index: false, follow: false },
  openGraph: { siteName: SITE.name, type: "website", locale: "ko_KR" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body>
        <Header />
        <main className="mx-auto min-h-[60vh] w-full max-w-[var(--container)] px-6">
          {children}
        </main>
        <Footer />
        {GA_ID ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
