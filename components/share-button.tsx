"use client";

// Generates a public read-only share link for a campaign on demand.
// Shows the resulting URL with a one-click copy-to-clipboard.

import { useState, useTransition } from "react";
import { createCampaignShareLink } from "@/app/campaigns/[id]/actions";
import { useT } from "@/lib/i18n/client";

export function ShareButton({ campaignId }: { campaignId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useT();

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const newUrl = await createCampaignShareLink(campaignId);
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
      // Clipboard might be blocked (e.g. http context) — selection fallback.
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
        className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
      >
        {isPending ? t("share_button.generating") : t("share_button.label")}
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
          {copied ? t("share_button.copied") : t("share_button.copy")}
        </button>
      </div>
      <p className="text-[10px] text-zinc-500">{t("share_button.note")}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
