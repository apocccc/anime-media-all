import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Bang, StarSpark } from "@/components/site/Doodads";

export default async function NotFoundPage() {
  const t = await getTranslations("notFound");

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <div className="relative inline-block">
        <StarSpark size={26} className="absolute -left-10 top-2" />
        <Bang size={30} color="#eb4e5d" className="absolute -right-11 top-0" />
        <p className="font-display text-[96px] leading-none text-primary [-webkit-text-stroke:2px_#141d28]">
          404
        </p>
      </div>
      <h1 className="mt-5 font-heading text-2xl font-extrabold uppercase text-ink">
        {t("title")}
      </h1>
      <p className="mt-2 text-gray">{t("description")}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-[42px] items-center rounded-[7px] border-2 border-ink bg-primary px-7 font-heading text-[15px] font-extrabold uppercase text-white hover:bg-primary-dark"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
