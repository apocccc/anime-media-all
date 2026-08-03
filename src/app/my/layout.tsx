import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { inter } from "@/lib/fonts";
import { SITE_NAME } from "@/lib/site";
import "../globals.css";

export const metadata: Metadata = {
  title: `My Page | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

/** 会員マイページ(noindex・動的レンダリング) */
export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans bg-bg-sub text-ink min-h-screen`}
      >
        <NextIntlClientProvider>
          <header className="border-b border-line bg-bg px-6 py-4">
            <Link href="/en" className="text-lg font-black text-primary">
              {SITE_NAME}{" "}
              <span className="text-xs font-medium text-gray">My Page</span>
            </Link>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
