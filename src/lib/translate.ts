import { prisma } from "@/lib/prisma";
import type { JSONContent } from "@tiptap/core";
import type { Locale as DbLocale } from "@prisma/client";
import { aiCompleteJson, modelForRole } from "@/lib/ai/provider";
import {
  applyTranslations,
  changedBlockIndexes,
  docHashes,
  parseHashes,
  serializeHashes,
  splitBlocks,
} from "@/lib/blocks";
import {
  findTermsInText,
  glossaryForLocale,
  hasBlockingPendingTerms,
  verifyGlossary,
  type GlossaryPair,
} from "@/lib/glossary";
import { enqueueJob } from "@/lib/jobs";
import { PUBLIC_DB_LOCALES, fromDbLocale } from "@/lib/locale";

/**
 * 翻訳パイプライン(§4.3)。
 * ja マスター → 各ロケールへ並列翻訳(多段翻訳禁止)。
 * - ブロック単位で sourceHash を管理し、変更ブロックのみ再翻訳
 * - 用語辞書の確定表記を制約としてプロンプトに注入
 * - 出力を文字列で機械検証 → NG なら1回だけ自動リペア → なお NG は needs_review
 */

export class TranslateError extends Error {}

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "英語(en)。ヘボン式ローマ字・マクロン無し。人名の語順は公式表記に従い、無ければ「姓 名」。",
  ko: "韓国語(ko)。국립국어원 외래어 표기법(일본어)に従う。",
  zh_Hant: "繁体字中国語(zh-Hant、台湾向け)。台湾の慣用語彙を使う(網路・影片など)。",
  th: "タイ語(th)。ราชบัณฑิตยสภา の日本語転写規則に準拠。",
  zh_Hans: "簡体字中国語(zh-Hans、中国大陸向け)。大陸の慣用語彙を使う(网络・视频など)。繁体字からの機械変換ではなく日本語から翻訳する。",
};

type TranslateBlocksResult = { blocks?: { id: string; text: string }[] };

async function callTranslator(
  locale: DbLocale,
  blocks: { id: string; text: string }[],
  glossary: GlossaryPair[],
  repairNote?: string
): Promise<Map<string, string>> {
  const system = [
    "あなたは日本のアニメ・エンタメ報道を専門とするプロ翻訳者です。",
    `原文(日本語)を ${LOCALE_INSTRUCTIONS[locale] ?? locale} へ翻訳してください。`,
    "規則:",
    "1. ニュース記事としての自然な文体。意訳しすぎず事実関係を正確に保つ。",
    "2. 用語表(glossary)にある語は「必ずこの表記を使う」こと。別表記・別訳語は不具合として扱われる。",
    "3. [IMAGE_n] マーカー・URL・数値・日付は改変しない。",
    "4. 各ブロックは id を保持したまま訳文のみ返す。ブロックの追加・削除・結合をしない。",
    '5. 出力JSON: {"blocks": [{"id": "...", "text": "訳文"}]}',
    ...(repairNote ? ["", `前回の出力には次の問題があった。必ず修正すること: ${repairNote}`] : []),
  ].join("\n");

  const user = JSON.stringify({
    locale: fromDbLocale(locale),
    glossary,
    blocks,
  });

  const result = await aiCompleteJson<TranslateBlocksResult>({
    role: "translate",
    system,
    user,
  });
  const map = new Map<string, string>();
  for (const b of result.blocks ?? []) {
    if (typeof b.id === "string" && typeof b.text === "string") {
      map.set(b.id, b.text);
    }
  }
  return map;
}

function textOfDoc(doc: JSONContent): string {
  const parts: string[] = [];
  const walk = (node: JSONContent): void => {
    if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(doc);
  return parts.join("");
}

export type TranslateArticleResult = {
  status: "machine" | "needs_review" | "skipped_excluded" | "skipped_human";
  violations: number;
};

/**
 * 1記事×1ロケールの翻訳を実行し ArticleTranslation を upsert する。
 * 既存翻訳が excluded / human 翻訳の場合はスキップ。
 */
export async function translateArticle(
  articleId: string,
  locale: DbLocale
): Promise<TranslateArticleResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { translations: true },
  });
  if (!article) throw new TranslateError(`Article not found: ${articleId}`);

  const master = article.translations.find((t) => t.locale === article.masterLocale);
  if (!master) throw new TranslateError(`Master translation missing: ${articleId}`);

  const existing = article.translations.find((t) => t.locale === locale);
  if (existing?.status === "excluded") {
    return { status: "skipped_excluded", violations: 0 };
  }
  if (existing?.translatedBy === "human") {
    return { status: "skipped_human", violations: 0 };
  }

  const masterBody = master.body as JSONContent;
  const blocks = splitBlocks(masterBody);
  const currentHashes = docHashes(masterBody);

  // 変更ブロックのみ再翻訳(構造が変わった場合は全再翻訳)
  const previousHashes = existing ? parseHashes(existing.sourceHash) : null;
  const changed = changedBlockIndexes(currentHashes, previousHashes);
  const translateAll = changed === null || !existing;

  // 用語辞書: マスター全文で突合し、当該ロケールの確定表記を注入
  const masterText = `${master.title}\n${master.lead}\n${textOfDoc(masterBody)}`;
  const terms = await findTermsInText(masterText);
  const glossary = glossaryForLocale(terms, locale);

  // 翻訳対象ブロック(title/lead は特別ブロックとして常に翻訳)
  const payload: { id: string; text: string }[] = [
    { id: "title", text: master.title },
    { id: "lead", text: master.lead },
  ];
  for (const block of blocks) {
    if (!translateAll && !changed!.has(block.index)) continue;
    payload.push(...block.texts);
  }

  let translations = await callTranslator(locale, payload, glossary);

  const buildOutput = () => {
    const title = translations.get("title") ?? master.title;
    const lead = translations.get("lead") ?? master.lead;
    // 変更されなかったブロックは既存訳文を保持する
    let body: JSONContent;
    if (translateAll || !existing) {
      body = applyTranslations(masterBody, translations);
    } else {
      const existingBody = existing.body as JSONContent;
      const newBody = applyTranslations(masterBody, translations);
      body = {
        ...newBody,
        content: (newBody.content ?? []).map((node, i) =>
          changed!.has(i) ? node : ((existingBody.content ?? [])[i] ?? node)
        ),
      };
    }
    return { title, lead, body };
  };

  let output = buildOutput();
  let outputText = `${output.title}\n${output.lead}\n${textOfDoc(output.body)}`;
  let violations = verifyGlossary(masterText, outputText, glossary);

  // NG なら1回だけ自動リペア
  if (violations.length > 0) {
    const note = violations
      .map((v) => `「${v.source}」は必ず「${v.expected}」と表記する`)
      .join(" / ");
    translations = await callTranslator(locale, payload, glossary, note);
    output = buildOutput();
    outputText = `${output.title}\n${output.lead}\n${textOfDoc(output.body)}`;
    violations = verifyGlossary(masterText, outputText, glossary);
  }

  // コア用語の pending がある場合も needs_review(既定で自動公開しない)
  const blocked = await hasBlockingPendingTerms(masterText);
  const status = violations.length > 0 || blocked ? "needs_review" : "machine";

  await prisma.articleTranslation.upsert({
    where: { articleId_locale: { articleId, locale } },
    create: {
      articleId,
      locale,
      title: output.title,
      lead: output.lead,
      body: output.body as object,
      status,
      translatedBy: "ai",
      model: modelForRole("translate"),
      sourceHash: serializeHashes(currentHashes),
    },
    update: {
      title: output.title,
      lead: output.lead,
      body: output.body as object,
      status,
      translatedBy: "ai",
      model: modelForRole("translate"),
      sourceHash: serializeHashes(currentHashes),
    },
  });

  return { status, violations: violations.length };
}

/**
 * 記事の全公開ロケール分の翻訳ジョブを投入する。
 * excluded / human 翻訳のロケールはジョブ側でスキップされる。
 */
export async function queueArticleTranslations(articleId: string): Promise<number> {
  let queued = 0;
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { masterLocale: true, updatedAt: true },
  });
  if (!article) return 0;
  for (const locale of PUBLIC_DB_LOCALES) {
    if (locale === article.masterLocale) continue;
    await enqueueJob(
      "translate_article",
      { articleId, locale },
      `translate:${articleId}:${locale}:${article.updatedAt.getTime()}`
    );
    queued++;
  }
  return queued;
}
