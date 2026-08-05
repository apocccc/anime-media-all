"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

/** 検索ボックス(§10)。2px罫線+内包コーラルボタン。影なし */
export function SearchForm({
  placeholder,
  buttonLabel,
}: {
  placeholder: string;
  buttonLabel: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      className="hidden h-[46px] w-[220px] items-center overflow-hidden rounded-[11px] border-2 border-ink bg-surface md:flex xl:w-[290px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={buttonLabel}
        className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-[#a29fa9]"
      />
      <button
        type="submit"
        className="flex h-full w-[49px] shrink-0 items-center justify-center bg-primary text-white hover:bg-primary-dark"
        aria-label={buttonLabel}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
    </form>
  );
}
