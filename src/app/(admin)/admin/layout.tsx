import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { auth } from "@/lib/auth";
import { inter } from "@/lib/fonts";
import { SITE_NAME } from "@/lib/site";
import "../../globals.css";

export const metadata: Metadata = {
  title: `${SITE_NAME} Admin`,
  robots: { index: false, follow: false },
};

function toAdminLocale(value?: string): "ja" | "en" {
  return value === "en" ? "en" : "ja";
}

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // クッキー(ログイン時・言語変更時に同期)優先、なければセッションのプロフィール設定
  const store = await cookies();
  const session = await auth();
  const cookieLocale = store.get("ADMIN_LOCALE")?.value;
  const locale = toAdminLocale(cookieLocale ?? session?.user?.adminLocale);
  const messages = (await import(`../../../../messages/${locale}/admin.json`))
    .default;

  return (
    <html lang={locale}>
      <body
        className={`${inter.variable} font-sans bg-bg-sub text-ink min-h-screen`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
