import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/lib/query-client";

export const metadata = { title: "dndn" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
