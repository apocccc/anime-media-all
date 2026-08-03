"use client";

import { useState, useTransition } from "react";
import { voteAction } from "@/app/(site)/[locale]/fans/actions";

/** 投票ボタン(動的部分のみクライアント) */
export function VoteButton({
  postId,
  initialVotes,
  labels,
  signedIn,
}: {
  postId: string;
  initialVotes: number;
  labels: { vote: string; voted: string; loginToVote: string };
  signedIn: boolean;
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    // ロケール外ルートへの遷移のため <a> を使用
    return (
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      <a
        href="/api/auth/signin"
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm text-gray hover:border-primary hover:text-primary"
      >
        ♥ {labels.loginToVote}
      </a>
    );
  }

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
          }
        })
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
        voted
          ? "bg-primary-light text-primary-dark"
          : "bg-primary text-white hover:bg-primary-dark"
      }`}
    >
      ♥ {voted ? labels.voted : labels.vote} ({votes})
    </button>
  );
}
