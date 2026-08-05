"use client";

import { useFormStatus } from "react-dom";

/**
 * サーバーアクション用の送信ボタン(§12 管理UX)。
 * 実行中は自動で無効化+スピナー表示し、二重送信(連打)を防ぐ。
 * variant で既存の配色を踏襲。押下時は 1px 沈む(影は使わない)。
 */
type Variant = "primary" | "ink" | "outline" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary px-4 py-1.5 text-xs text-white hover:bg-primary-dark",
  ink: "bg-ink px-3 py-1.5 text-xs text-white hover:bg-ink/80",
  outline:
    "border border-line px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary",
  danger:
    "border border-line px-3 py-1.5 text-xs text-gray hover:border-breaking hover:text-breaking",
};

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded font-bold transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
