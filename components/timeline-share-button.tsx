"use client";

// Generates a public read-only link to the *current dashboard view* (date
// range + active filters). Reads URL params via useSearchParams so it
// captures whatever the user has currently dialed in.

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createTimelineShareLink } from "@/app/campaigns/[id]/actions";

export function TimelineShareButton() {
  const params = useSearchParams();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setCopied(false);

    const filters: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      filters[k] = v;
    }

    startTransition(async () => {
      try {
        const newUrl = await createTimelineShareLink(filters);
        setUrl(newUrl);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts (older browsers / file://).
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!url) {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        title="Vytvořit veřejný odkaz na aktuálně viditelnou timeline"
        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
      >
        {isPending ? "Generuji…" : "Sdílet timeline"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex items-center gap-1">
        <input
          readOnly
          value={url}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs font-mono w-72 max-w-[60vw]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
        >
          {copied ? "✓ Zkopírováno" : "Kopírovat"}
        </button>
        <button
          type="button"
          onClick={() => setUrl(null)}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1"
          title="Zavřít"
        >
          ✕
        </button>
      </div>
      <p className="text-[10px] text-zinc-500">
        Platnost 30 dní. Klient uvidí celou timeline ve stejném rozsahu a
        s aplikovanými filtry, bez přihlášení a bez editačních tlačítek.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
