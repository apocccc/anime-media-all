"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitPressReleaseAction } from "@/app/partner/partner-actions";
import { TurnstileWidget } from "@/components/site/TurnstileWidget";

const LOCALES = ["ja", "en", "ko", "zh_Hant", "th", "zh_Hans"] as const;
const PUBLIC_LOCALES = ["en", "ko", "zh_Hant", "th", "zh_Hans"] as const;

/** プレスリリース投稿フォーム(§7.1)。翻訳オプション必須要件を含む */
export function PressReleaseForm() {
  const t = useTranslations("partner.submit");
  const [state, action, pending] = useActionState(submitPressReleaseAction, {
    error: null,
    ok: false,
  });

  return (
    <form action={action} className="mt-4 flex flex-col gap-3 text-sm">
      {state.ok ? (
        <p className="rounded bg-green-50 px-3 py-2 text-green-800">
          {t("submitted")}
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-red-800">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="font-bold">{t("titleLabel")}</span>
        <input
          name="title"
          required
          maxLength={300}
          className="rounded border border-line bg-bg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">{t("leadLabel")}</span>
        <input
          name="lead"
          maxLength={500}
          className="rounded border border-line bg-bg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">{t("bodyLabel")}</span>
        <textarea
          name="body"
          required
          rows={10}
          placeholder={t("bodyPlaceholder")}
          className="rounded border border-line bg-bg px-3 py-2"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("originalLocale")}</span>
          <select
            name="originalLocale"
            defaultValue="ja"
            className="rounded border border-line bg-bg px-3 py-2"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l.replace("_", "-")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("embargo")}</span>
          <input
            type="datetime-local"
            name="embargoAt"
            className="rounded border border-line bg-bg px-3 py-2"
          />
        </label>
      </div>

      {/* 翻訳オプション(必須要件): 既定=全言語 / 翻訳不要 / 個別選択 */}
      <fieldset className="rounded border border-line bg-bg-sub p-3">
        <legend className="px-1 font-bold">{t("translationOption")}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="translationMode" value="all" defaultChecked />
          {t("translateAll")}
        </label>
        <label className="mt-1.5 flex items-center gap-2">
          <input type="radio" name="translationMode" value="none" />
          {t("translateNone")}
        </label>
        <label className="mt-1.5 flex items-center gap-2">
          <input type="radio" name="translationMode" value="custom" />
          {t("translateCustom")}
        </label>
        <div className="mt-2 flex flex-wrap gap-3 pl-6">
          {PUBLIC_LOCALES.map((l) => (
            <label key={l} className="flex items-center gap-1 text-xs">
              <input type="checkbox" name={`translate_${l}`} />
              {l.replace("_", "-")}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-bold">{t("contact")}</span>
        <input
          name="contact"
          maxLength={500}
          className="rounded border border-line bg-bg px-3 py-2"
        />
      </label>

      <TurnstileWidget />

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-primary px-6 py-2 font-bold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {pending ? "…" : t("submitButton")}
      </button>
    </form>
  );
}
