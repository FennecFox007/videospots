"use client";

// Generates a public read-only share link for a campaign. Three states:
//   1. trigger button — "Sdílet"
//   2. configure form — pick expiry preset + optional label, hit Generate
//   3. result        — show URL with copy-to-clipboard
// User can dismiss between (1)-(2) and (2)-(3) without committing anything;
// the link is only persisted when "Vytvořit" is pressed in state (2).
//
// Revocation is intentionally NOT here — it lives in <CampaignShareLinks>
// (the management list rendered alongside this button on /campaigns/[id]).
// Splitting the surface keeps each concern small: this button creates
// links, the list manages them.

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createCampaignShareLink } from "@/app/campaigns/[id]/actions";
import { useT } from "@/lib/i18n/client";
import { ShareCreateForm } from "@/components/share-create-form";

type Mode = "idle" | "configuring" | "showing";

export function ShareButton({ campaignId }: { campaignId: number }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const t = useT();
  const router = useRouter();

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

  if (mode === "idle") {
    return (
      <button
        type="button"
        onClick={() => setMode("configuring")}
        className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5"
      >
        <Share2 className="w-4 h-4" strokeWidth={2} />
        {t("share_button.label")}
      </button>
    );
  }

  if (mode === "configuring") {
    return (
      <ShareCreateForm
        onCancel={() => setMode("idle")}
        onCreate={async (opts) => {
          const newUrl = await createCampaignShareLink(campaignId, opts);
          setUrl(newUrl);
          setMode("showing");
          // The per-campaign management list re-renders from server data.
          router.refresh();
          return newUrl;
        }}
      />
    );
  }

  // mode === "showing"
  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex items-center gap-1">
        <input
          readOnly
          value={url ?? ""}
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
        <button
          type="button"
          onClick={() => {
            setMode("idle");
            setUrl(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1"
          title={t("common.close")}
        >
          ✕
        </button>
      </div>
      <p className="text-[10px] text-zinc-500">{t("share_button.note")}</p>
    </div>
  );
}
