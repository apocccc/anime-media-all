"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { castVote } from "@/lib/prize";

/** 投票(Server Action)。1ユーザー1投稿1票/サイクル */
export async function voteAction(postId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthenticated" };
  const result = await castVote(session.user.id, postId);
  if (result.ok) {
    try {
      revalidatePath(`/fans/${postId}`);
    } catch {
      // no-op
    }
  }
  return result;
}
