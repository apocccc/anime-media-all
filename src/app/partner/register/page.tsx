"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { registerPartnerAction } from "../partner-actions";
import { TurnstileWidget } from "@/components/site/TurnstileWidget";

/** 事業者アカウント登録(管理者審査後に投稿可能。§7.1) */
export default function PartnerRegisterPage() {
  const t = useTranslations("partner.registerForm");
  const [state, action, pending] = useActionState(registerPartnerAction, {
    error: null,
  });

  return (
    <div className="mx-auto max-w-md rounded-lg border border-line bg-bg p-6">
      <h1 className="text-xl font-black">{t("title")}</h1>
      <p className="mt-1 text-xs text-gray">{t("note")}</p>
      {state.error ? (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <form action={action} className="mt-4 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("companyName")}</span>
          <input
            name="companyName"
            required
            className="rounded border border-line bg-bg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("websiteUrl")}</span>
          <input
            name="websiteUrl"
            type="url"
            required
            placeholder="https://"
            className="rounded border border-line bg-bg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("contactName")}</span>
          <input
            name="contactName"
            required
            className="rounded border border-line bg-bg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("email")}</span>
          <input
            name="email"
            type="email"
            required
            className="rounded border border-line bg-bg px-3 py-2"
          />
          <span className="text-[11px] text-gray">{t("emailNote")}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("password")}</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded border border-line bg-bg px-3 py-2"
          />
        </label>
        <TurnstileWidget />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-4 py-2 font-bold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {t("submit")}
        </button>
      </form>
    </div>
  );
}
