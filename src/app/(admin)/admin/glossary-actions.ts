"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs";
import { PUBLIC_DB_LOCALES } from "@/lib/locale";
import type { Locale as DbLocale, TermStatus, TermType } from "@prisma/client";

async function requireGlossaryManager() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "admin" && session.user.role !== "editor") {
    redirect("/admin");
  }
  return session.user;
}

const TERM_TYPES: TermType[] = [
  "series", "character", "person", "studio", "company",
  "event", "product", "music", "term",
];

const termSchema = z.object({
  id: z.string().optional(),
  type: z.string().refine((v) => TERM_TYPES.includes(v as TermType)),
  nameJa: z.string().min(1).max(200),
  readingJa: z.string().max(200).optional(),
  romaji: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  sourceUrl: z.string().max(500).optional(),
  doNotTranslate: z.boolean(),
});

/** 用語の作成・更新 + ロケール別確定表記(form_{locale})の保存 */
export async function saveTermAction(formData: FormData) {
  const user = await requireGlossaryManager();
  const parsed = termSchema.parse({
    id: (formData.get("id") as string) || undefined,
    type: formData.get("type"),
    nameJa: formData.get("nameJa"),
    readingJa: (formData.get("readingJa") as string) || undefined,
    romaji: (formData.get("romaji") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    sourceUrl: (formData.get("sourceUrl") as string) || undefined,
    doNotTranslate: formData.get("doNotTranslate") === "on",
  });

  const term = parsed.id
    ? await prisma.term.update({
        where: { id: parsed.id },
        data: {
          type: parsed.type as TermType,
          nameJa: parsed.nameJa,
          readingJa: parsed.readingJa ?? null,
          romaji: parsed.romaji ?? "",
          notes: parsed.notes ?? null,
          sourceUrl: parsed.sourceUrl ?? null,
          doNotTranslate: parsed.doNotTranslate,
        },
      })
    : await prisma.term.create({
        data: {
          type: parsed.type as TermType,
          status: "pending",
          nameJa: parsed.nameJa,
          readingJa: parsed.readingJa ?? null,
          romaji: parsed.romaji ?? "",
          notes: parsed.notes ?? null,
          sourceUrl: parsed.sourceUrl ?? null,
          doNotTranslate: parsed.doNotTranslate,
        },
      });

  let formsChanged = false;
  for (const locale of PUBLIC_DB_LOCALES) {
    const value = formData.get(`form_${locale}`);
    const isOfficial = formData.get(`official_${locale}`) === "on";
    const sourceUrl = (formData.get(`formSource_${locale}`) as string) || null;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    const existing = await prisma.termForm.findUnique({
      where: { termId_locale: { termId: term.id, locale } },
    });
    if (!trimmed) {
      if (existing) {
        await prisma.termForm.delete({ where: { id: existing.id } });
        formsChanged = true;
      }
      continue;
    }
    if (existing?.value !== trimmed || existing?.isOfficial !== isOfficial) {
      formsChanged = true;
    }
    await prisma.termForm.upsert({
      where: { termId_locale: { termId: term.id, locale } },
      create: {
        termId: term.id,
        locale,
        value: trimmed,
        isOfficial,
        sourceUrl,
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      update: {
        value: trimmed,
        isOfficial,
        sourceUrl,
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
    });
  }

  // エイリアス(改行区切り)
  const aliasesRaw = formData.get("aliases");
  if (typeof aliasesRaw === "string") {
    await prisma.termAlias.deleteMany({ where: { termId: term.id } });
    const values = aliasesRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    for (const value of values) {
      await prisma.termAlias.create({
        data: { termId: term.id, value, kind: "alias" },
      });
    }
  }

  // 表記変更の波及: locked 以外の確定表記が変わったら再翻訳ジョブを投入(§5.3)
  if (formsChanged && term.status !== "pending") {
    await enqueueJob(
      "retranslate_term",
      { termId: term.id },
      `retranslate-term:${term.id}:${Date.now()}`
    );
  }

  revalidatePath("/admin/glossary");
}

/** ステータス変更(承認 / locked / deprecated) */
export async function setTermStatusAction(formData: FormData) {
  await requireGlossaryManager();
  const id = formData.get("id") as string;
  const status = z
    .enum(["pending", "verified", "locked", "deprecated"])
    .parse(formData.get("status")) as TermStatus;
  await prisma.term.update({ where: { id }, data: { status } });
  revalidatePath("/admin/glossary");
}

/** 一括承認(pending → verified) */
export async function bulkVerifyTermsAction(formData: FormData) {
  await requireGlossaryManager();
  const ids = formData.getAll("ids").map(String).filter(Boolean).slice(0, 200);
  if (ids.length === 0) return;
  await prisma.term.updateMany({
    where: { id: { in: ids }, status: "pending" },
    data: { status: "verified" },
  });
  revalidatePath("/admin/glossary");
}

export async function deleteTermAction(formData: FormData) {
  await requireGlossaryManager();
  const id = formData.get("id") as string;
  await prisma.term.delete({ where: { id } });
  revalidatePath("/admin/glossary");
}

/** CSVエクスポート用のデータ取得(nameJa, type, status, 各ロケール表記) */
export async function exportGlossaryCsvAction(): Promise<string> {
  await requireGlossaryManager();
  const terms = await prisma.term.findMany({
    include: { forms: true },
    orderBy: { nameJa: "asc" },
  });
  const header = ["nameJa", "type", "status", "romaji", ...PUBLIC_DB_LOCALES];
  const rows = terms.map((t) => [
    t.nameJa,
    t.type,
    t.status,
    t.romaji,
    ...PUBLIC_DB_LOCALES.map(
      (l) => t.forms.find((f) => f.locale === (l as DbLocale))?.value ?? ""
    ),
  ]);
  return [header, ...rows]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

/** CSVインポート(nameJa,type,romaji,en,ko,zh_Hant,th,zh_Hans) */
export async function importGlossaryCsvAction(formData: FormData) {
  await requireGlossaryManager();
  const raw = formData.get("csv");
  if (typeof raw !== "string" || !raw.trim()) return;
  const lines = raw.trim().split("\n").slice(0, 2000);
  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [nameJa, type, romaji, ...formValues] = cols;
    if (!nameJa || nameJa === "nameJa") continue;
    if (!TERM_TYPES.includes(type as TermType)) continue;
    const existing = await prisma.term.findFirst({
      where: { nameJa },
      select: { id: true },
    });
    const term = existing
      ? await prisma.term.update({
          where: { id: existing.id },
          data: { type: type as TermType, romaji: romaji ?? "" },
        })
      : await prisma.term.create({
          data: {
            nameJa,
            type: type as TermType,
            status: "pending",
            romaji: romaji ?? "",
          },
        });
    for (const [i, locale] of PUBLIC_DB_LOCALES.entries()) {
      const value = formValues[i]?.trim();
      if (!value) continue;
      await prisma.termForm.upsert({
        where: { termId_locale: { termId: term.id, locale } },
        create: { termId: term.id, locale, value },
        update: { value },
      });
    }
  }
  revalidatePath("/admin/glossary");
}
