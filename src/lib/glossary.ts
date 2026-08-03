import { prisma } from "@/lib/prisma";
import { aiCompleteJson, aiConfigured } from "@/lib/ai/provider";
import type { Locale as DbLocale, Term, TermForm, TermAlias, TermType } from "@prisma/client";

/**
 * 固有名詞辞書(Glossary)。表記揺れは「翻訳の質」ではなく「不具合」として扱う。
 * - 前処理: マスター(ja)本文から用語を突合し、確定表記を翻訳プロンプトへ注入
 * - 後処理: 出力に確定表記が現れているかを文字列で機械検証(AIの自己申告に頼らない)
 * - 未登録語: pending で自動登録し、コア用語の pending がある記事は自動公開しない
 */

export type TermWithRelations = Term & { forms: TermForm[]; aliases: TermAlias[] };

/** 自動公開をブロックする用語タイプ */
export const CORE_TERM_TYPES: TermType[] = ["series", "character", "person", "studio"];

/** マスター本文に登場する登録済み用語を返す(nameJa / alias で突合) */
export async function findTermsInText(text: string): Promise<TermWithRelations[]> {
  const terms = await prisma.term.findMany({
    where: { status: { not: "deprecated" } },
    include: { forms: true, aliases: true },
  });
  return terms.filter((term) => {
    if (term.nameJa && text.includes(term.nameJa)) return true;
    return term.aliases.some((a) => a.value && text.includes(a.value));
  });
}

export type GlossaryPair = {
  /** 原文(ja)表記 */
  source: string;
  /** 当該ロケールの確定表記 */
  target: string;
};

/**
 * 当該ロケールの用語表を組み立てる。
 * doNotTranslate は原語のまま出す。確定表記が無い用語は含めない(=検証対象外)。
 */
export function glossaryForLocale(
  terms: TermWithRelations[],
  locale: DbLocale
): GlossaryPair[] {
  const pairs: GlossaryPair[] = [];
  for (const term of terms) {
    if (term.doNotTranslate) {
      pairs.push({ source: term.nameJa, target: term.nameJa });
      continue;
    }
    const form = term.forms.find((f) => f.locale === locale);
    if (form?.value) {
      pairs.push({ source: term.nameJa, target: form.value });
    }
  }
  return pairs;
}

export type GlossaryViolation = {
  source: string;
  expected: string;
};

/**
 * 出力検証: マスターに登場する用語の確定表記が訳文に現れているかを機械検証する。
 * sourceText に source が含まれる場合のみ、outputText に target を要求する。
 */
export function verifyGlossary(
  sourceText: string,
  outputText: string,
  pairs: GlossaryPair[]
): GlossaryViolation[] {
  const violations: GlossaryViolation[] = [];
  for (const pair of pairs) {
    if (!sourceText.includes(pair.source)) continue;
    if (!outputText.includes(pair.target)) {
      violations.push({ source: pair.source, expected: pair.target });
    }
  }
  return violations;
}

/** 記事内に CORE_TERM_TYPES の pending 用語があるか(自動公開ブロック判定) */
export async function hasBlockingPendingTerms(text: string): Promise<boolean> {
  const terms = await findTermsInText(text);
  return terms.some(
    (t) => t.status === "pending" && CORE_TERM_TYPES.includes(t.type)
  );
}

type ExtractedTerm = {
  nameJa: string;
  type: TermType;
  readingJa?: string;
  romaji?: string;
};

const TERM_TYPES: TermType[] = [
  "series",
  "character",
  "person",
  "studio",
  "company",
  "event",
  "product",
  "music",
  "term",
];

/**
 * AI による固有名詞候補の抽出。既知の用語は除いて pending 登録する。
 * AI未設定(mock含む)の場合は空配列(=抽出なし)で成功扱い。
 */
export async function extractAndRegisterTerms(articleId: string, text: string): Promise<number> {
  if (!aiConfigured()) return 0;
  let extracted: { terms?: ExtractedTerm[] };
  try {
    extracted = await aiCompleteJson<{ terms?: ExtractedTerm[] }>({
      role: "moderate",
      system: [
        "あなたは日本のアニメ業界に詳しい編集者です。",
        "与えられた日本語ニュース原稿から固有名詞を抽出してください。",
        `type は ${TERM_TYPES.join(" | ")} のいずれか。`,
        "一般名詞・日付・数値は含めない。",
        '出力JSON: {"terms": [{"nameJa": "...", "type": "series", "readingJa": "かな", "romaji": "hepburn"}]}',
      ].join("\n"),
      user: text.slice(0, 8000),
    });
  } catch {
    return 0;
  }

  let registered = 0;
  for (const c of extracted.terms ?? []) {
    if (!c.nameJa?.trim() || !TERM_TYPES.includes(c.type)) continue;
    const nameJa = c.nameJa.trim();
    const exists = await prisma.term.findFirst({
      where: {
        OR: [{ nameJa }, { aliases: { some: { value: nameJa } } }],
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.term.create({
      data: {
        nameJa,
        type: c.type,
        status: "pending",
        readingJa: c.readingJa?.trim() || null,
        romaji: c.romaji?.trim() || "",
        notes: `auto-extracted from article ${articleId}`,
      },
    });
    registered++;
  }
  return registered;
}

/**
 * 公開済み記事の用語監査: 確定表記と異なる表記が使われている記事を検出する。
 * 戻り値は違反一覧(記事ID・ロケール・用語)。
 */
export async function auditPublishedArticles(limit = 200): Promise<
  { articleId: string; locale: DbLocale; source: string; expected: string }[]
> {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { translations: true },
  });
  const results: { articleId: string; locale: DbLocale; source: string; expected: string }[] = [];

  for (const article of articles) {
    const master = article.translations.find((t) => t.locale === article.masterLocale);
    if (!master) continue;
    const masterText = `${master.title}\n${master.lead}\n${textOfBody(master.body)}`;
    const terms = await findTermsInText(masterText);
    if (terms.length === 0) continue;

    for (const t of article.translations) {
      if (t.locale === article.masterLocale) continue;
      if (!["approved", "machine"].includes(t.status)) continue;
      const pairs = glossaryForLocale(terms, t.locale);
      const outputText = `${t.title}\n${t.lead}\n${textOfBody(t.body)}`;
      for (const v of verifyGlossary(masterText, outputText, pairs)) {
        results.push({
          articleId: article.id,
          locale: t.locale,
          source: v.source,
          expected: v.expected,
        });
      }
    }
  }
  return results;
}

function textOfBody(body: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") parts.push(n.text);
    n.content?.forEach(walk);
  };
  walk(body);
  return parts.join("");
}
