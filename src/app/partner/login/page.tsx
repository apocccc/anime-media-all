"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { partnerLoginAction } from "../partner-actions";

export default function PartnerLoginPage() {
  const t = useTranslations("partner");
  const [state, action, pending] = useActionState(partnerLoginAction, {
    error: false,
  });

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-line bg-bg p-6">
      <h1 className="text-xl font-black">{t("login")}</h1>
      {state.error ? (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {t("loginError")}
        </p>
      ) : null}
      <form action={action} className="mt-4 flex flex-col gap-3 text-sm">
        <input
          name="email"
          type="email"
          placeholder="email"
          required
          className="rounded border border-line bg-bg px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="password"
          required
          className="rounded border border-line bg-bg px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-4 py-2 font-bold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {t("login")}
        </button>
      </form>
      <p className="mt-4 text-xs text-gray">
        <Link href="/partner/register" className="text-primary underline">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}
