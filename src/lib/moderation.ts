import { prisma } from "@/lib/prisma";
import { aiCompleteJson, aiConfigured } from "@/lib/ai/provider";
import { fromDbLocale, PUBLIC_DB_LOCALES } from "@/lib/locale";

/**
 * ファン投稿のモデレーション(§8.2)と投稿キャプション翻訳。
 * 一次: AI スクリーニング → スコアで自動却下 / 保留 / 通過
 * 二次: /admin/moderation で人手承認(influencer のみ自動承認+事後監査)
 */

export type ModerationVerdict = {
  verdict: "pass" | "hold" | "reject";
  scores: Record<string, number>;
  reason?: string;
};

const REJECT_THRESHOLD = 0.85;
const HOLD_THRESHOLD = 0.5;

export async function aiScreenFanPost(postId: string): Promise<ModerationVerdict> {
  const post = await prisma.fanPost.findUnique({
    where: { id: postId },
    include: { series: true },
  });
  if (!post) throw new Error(`FanPost not found: ${postId}`);

  let verdict: ModerationVerdict = {
    verdict: "hold",
    scores: {},
    reason: "AI screening unavailable",
  };

  if (aiConfigured()) {
    try {
      const result = await aiCompleteJson<{
        scores?: Record<string, number>;
        reason?: string;
      }>({
        role: "moderate",
        system: [
          "あなたはアニメファンコミュニティのモデレーターです。",
          "投稿を審査し、各リスクを 0〜1 でスコアリングしてください。",
          "評価軸: nsfw(性的表現)、violence(暴力)、hate(ヘイト)、pii(個人情報)、copyright(公式画像・本編スクショの無断転載の疑い)、spam(スパム/宣伝)。",
          '出力JSON: {"scores": {"nsfw": 0, "violence": 0, "hate": 0, "pii": 0, "copyright": 0, "spam": 0}, "reason": "特記事項"}',
        ].join("\n"),
        user: JSON.stringify({
          type: post.type,
          body: post.bodyOriginal.slice(0, 4000),
          series: post.series.titleJa,
          embedUrl: post.embedUrl,
        }),
      });
      const scores = result.scores ?? {};
      const max = Math.max(0, ...Object.values(scores));
      verdict = {
        verdict:
          max >= REJECT_THRESHOLD ? "reject" : max >= HOLD_THRESHOLD ? "hold" : "pass",
        scores,
        reason: result.reason,
      };
    } catch {
      // AI失敗時は人手レビューへ(保留)
      verdict = { verdict: "hold", scores: {}, reason: "AI screening failed" };
    }
  }

  // influencer は pass 時に自動承認(事後監査)。それ以外は常に人手レビュー待ち
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
    select: { role: true },
  });
  const autoApprove = author?.role === "influencer" && verdict.verdict === "pass";

  await prisma.fanPost.update({
    where: { id: postId },
    data: {
      aiModerationScore: { ...verdict.scores, reason: verdict.reason ?? "" },
      ...(verdict.verdict === "reject"
        ? { status: "rejected", rejectReason: verdict.reason ?? "auto-rejected" }
        : autoApprove
          ? { status: "approved", publishedAt: new Date() }
          : {}),
    },
  });
  await prisma.moderationLog.create({
    data: {
      targetType: "fan_post",
      targetId: postId,
      action:
        verdict.verdict === "reject"
          ? "auto_reject"
          : autoApprove
            ? "auto_approve"
            : "auto_flag",
      reason: verdict.reason?.slice(0, 500),
    },
  });

  return verdict;
}

/** 投稿キャプションを各ロケールへ翻訳する(原文は常に併記されるため付加情報) */
export async function translateFanPost(postId: string): Promise<number> {
  const post = await prisma.fanPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error(`FanPost not found: ${postId}`);
  if (!post.bodyOriginal.trim()) return 0;
  if (!aiConfigured()) return 0;

  let translated = 0;
  for (const locale of PUBLIC_DB_LOCALES) {
    if (locale === post.originalLocale) continue;
    try {
      const result = await aiCompleteJson<{ blocks?: { id: string; text: string }[] }>({
        role: "translate",
        system: [
          "あなたはアニメファンコミュニティの投稿を翻訳する翻訳者です。",
          "口語的なニュアンスを保ちつつ自然に翻訳してください。",
          '出力JSON: {"blocks": [{"id": "body", "text": "訳文"}]}',
        ].join("\n"),
        user: JSON.stringify({
          locale: fromDbLocale(locale),
          blocks: [{ id: "body", text: post.bodyOriginal.slice(0, 4000) }],
        }),
      });
      const body = result.blocks?.find((b) => b.id === "body")?.text;
      if (!body) continue;
      await prisma.fanPostTranslation.upsert({
        where: { postId_locale: { postId, locale } },
        create: { postId, locale, body, translatedBy: "ai" },
        update: { body, translatedBy: "ai" },
      });
      translated++;
    } catch {
      // 個別ロケールの失敗はスキップ(再実行で埋まる)
    }
  }
  return translated;
}
