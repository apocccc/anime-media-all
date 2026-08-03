"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitFanPostAction } from "@/app/my/my-actions";
import { TurnstileWidget } from "@/components/site/TurnstileWidget";

const TYPES = ["illustration", "cosplay", "photo", "text", "embed"] as const;
const LOCALES = ["ja", "en", "ko", "zh_Hant", "th", "zh_Hans"] as const;

/** ファン投稿フォーム(§8.1)。作品必須・規約同意必須・画像は自作のみ */
export function FanPostForm({
  seriesOptions,
  hasBirthMonth,
}: {
  seriesOptions: { id: string; label: string }[];
  hasBirthMonth: boolean;
}) {
  const t = useTranslations("my.form");
  const [state, action, pending] = useActionState(submitFanPostAction, {
    error: null,
    ok: false,
  });
  const [type, setType] = useState<(typeof TYPES)[number]>("illustration");
  const [mediaIds, setMediaIds] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("alt", file.name.replace(/\.[a-z0-9]+$/i, ""));
      const res = await fetch("/api/my/upload", { method: "POST", body: fd });
      if (res.ok) {
        const media = (await res.json()) as { id: string; url: string };
        setMediaIds((prev) => [...prev, media].slice(0, 4));
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const needsMedia = ["illustration", "cosplay", "photo"].includes(type);

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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("series")}</span>
          <select
            name="seriesId"
            required
            className="rounded border border-line bg-bg px-3 py-2"
          >
            <option value="">—</option>
            {seriesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("type")}</span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="rounded border border-line bg-bg px-3 py-2"
          >
            {TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`types.${tp}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {needsMedia ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-bold">{t("images")}</span>
          <p className="text-[11px] text-gray">{t("imagesNote")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {mediaIds.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.url}
                alt=""
                className="h-20 w-20 rounded object-cover"
              />
            ))}
            {mediaIds.length < 4 ? (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-line text-2xl text-gray hover:border-primary hover:text-primary">
                {uploading ? "…" : "+"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadImage}
                />
              </label>
            ) : null}
          </div>
          {mediaIds.map((m) => (
            <input key={m.id} type="hidden" name="mediaIds" value={m.id} />
          ))}
        </div>
      ) : null}

      {type === "embed" ? (
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("embedUrl")}</span>
          <input
            name="embedUrl"
            type="url"
            placeholder="https://x.com/..."
            className="rounded border border-line bg-bg px-3 py-2"
          />
          <span className="text-[11px] text-gray">{t("embedNote")}</span>
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="font-bold">{t("body")}</span>
        <textarea
          name="body"
          rows={4}
          maxLength={4000}
          className="rounded border border-line bg-bg px-3 py-2"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-bold">{t("language")}</span>
          <select
            name="originalLocale"
            defaultValue="en"
            className="rounded border border-line bg-bg px-3 py-2"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l.replace("_", "-")}
              </option>
            ))}
          </select>
        </label>
        {!hasBirthMonth ? (
          <label className="flex flex-col gap-1">
            <span className="font-bold">{t("birthMonth")}</span>
            <input
              name="birthMonth"
              type="month"
              required
              className="rounded border border-line bg-bg px-3 py-2"
            />
          </label>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="agreeTerms" required className="mt-0.5" />
        <span>{t("terms")}</span>
      </label>

      <TurnstileWidget />

      <button
        type="submit"
        disabled={pending || uploading}
        className="self-start rounded bg-primary px-6 py-2 font-bold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {pending ? "…" : t("submit")}
      </button>
    </form>
  );
}
