import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/site/SectionHeading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.privacy");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeading as="h1" color="bg-navy text-white">
        {t("title")}
      </SectionHeading>
      <div className="mt-6 rounded-[13px] border-2 border-ink bg-surface p-6 sm:p-8">
        <p className="text-[17px] leading-[1.8] text-ink">{t("body")}</p>
      </div>
    </div>
  );
}
