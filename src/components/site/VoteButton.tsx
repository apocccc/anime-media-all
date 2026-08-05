"use client";

import { useState, useTransition } from "react";
import { voteAction } from "@/app/(site)/[locale]/fans/actions";

/**
 * 投票ボタン(動的部分のみクライアント)。
 * 認証状態はサーバーで判定せず(=一覧はSSGを維持)、投票時に未ログインなら
 * サインインへ誘導する。size="sm" は一覧カード用のコンパクト表示。
 */
export function VoteButton({
  postId,
  initialVotes,
  labels,
  size = "md",
}: {
  postId: string;
  initialVotes: number;
  labels: { vote: string; voted: string };
  size?: "sm" | "md";
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [pending, startTransition] = useTransition();

  const sizeCls =
    size === "sm"
      ? "gap-1 border-2 px-2.5 py-1 text-[11px]"
      : "gap-1.5 border-2 px-4 py-1.5 text-sm";

  return (
    <button
      type="button"
      disabled={voted || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await voteAction(postId);
          if (result.ok) {
            setVotes((v) => v + 1);
            setVoted(true);
          } else if (result.error === "already_voted") {
            setVoted(true);
          } else if (result.error === "unauthenticated") {
            window.location.href = "/api/auth/signin";
          }
        })
      }
      className={`inline-flex shrink-0 cursor-pointer items-center rounded-full border-ink font-heading font-extrabold uppercase transition-colors active:translate-y-px disabled:cursor-default ${sizeCls} ${
        voted
          ? "bg-primary-light text-primary-dark"
          : "bg-primary text-white hover:bg-primary-dark"
      }`}
    >
      ♥ {size === "sm" ? "" : voted ? labels.voted : `${labels.vote} `}({votes})
    </button>
  );
}
