import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionHeading } from "@/components/site/SectionHeading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  return { title: t("title") };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.contact");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionHeading as="h1" color="bg-purple text-white">
        {t("title")}
      </SectionHeading>
      <div className="mt-6 rounded-[13px] border-2 border-ink bg-surface p-6 sm:p-8">
        <p className="text-[17px] leading-[1.8] text-ink">{t("body")}</p>
        <p className="mt-4 border-t border-dashed border-dash pt-4 text-[17px] text-ink">
          {t("email")}:{" "}
          <a
            href="mailto:contact@huandaonews.com"
            className="font-semibold text-primary underline underline-offset-4 hover:text-primary-dark"
          >
            contact@huandaonews.com
          </a>
        </p>
      </div>
    </div>
  );
}
