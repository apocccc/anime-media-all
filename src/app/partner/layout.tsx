import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { inter } from "@/lib/fonts";
import { SITE_NAME } from "@/lib/site";
import "../globals.css";

export const metadata: Metadata = {
  title: `Partner Portal | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

/** 事業者ポータル(noindex・動的レンダリング) */
export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        className={`${inter.variable} font-sans bg-bg-sub text-ink min-h-screen`}
      >
        <NextIntlClientProvider>
          <header className="border-b border-line bg-bg px-6 py-4">
            <p className="text-lg font-black text-primary">
              {SITE_NAME}{" "}
              <span className="text-xs font-medium text-gray">
                Partner Portal
              </span>
            </p>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
