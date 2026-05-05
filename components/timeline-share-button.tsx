"use client";

// Generates a public read-only link to the *current dashboard view* (date
// range + active filters). Reads URL params via useSearchParams so it
// captures whatever the user has currently dialed in.
//
// Three-state machine: idle → configuring → showing. The configure step
// renders <ShareCreateForm> as a popover anchored to the button so the
// toolbar's flex layout doesn't squeeze it. align="right" because this
// button typically sits at the rightmost edge of the toolbar — popping
// out leftward keeps the form on-screen.

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Share2 } from "lucide-react";
import { createTimelineShareLink } from "@/app/campaigns/[id]/actions";
import { useT } from "@/lib/i18n/client";
import { ShareCreateForm } from "@/components/share-create-form";

type Mode = "idle" | "configuring" | "showing";

export function TimelineShareButton() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const t = useT();

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

  // The trigger + popover live in a single relative wrapper so the
  // popover anchors to the button, not the toolbar root.
  return (
    <div className="relative inline-block">
      {mode === "showing" ? (
        <ShowingResult
          url={url ?? ""}
          copied={copied}
          onCopy={copy}
          onClose={() => {
            setMode("idle");
            setUrl(null);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setMode((m) => (m === "configuring" ? "idle" : "configuring"))}
          title={t("timeline_share.title")}
          className={
            "rounded-md border px-3.5 py-2 text-sm inline-flex items-center gap-1.5 transition-colors " +
            (mode === "configuring"
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900")
          }
          aria-expanded={mode === "configuring"}
        >
          <Share2 className="w-4 h-4" strokeWidth={2} />
          {t("timeline_share.label")}
        </button>
      )}

      {mode === "configuring" && (
        <ShareCreateForm
          align="right"
          onCancel={() => setMode("idle")}
          onCreate={async (opts) => {
            // Snapshot current URL params at create time. The form runs in
            // a transition, but params is already a stable reference here;
            // we don't need to re-read inside the action.
            const filters: Record<string, string> = {};
            for (const [k, v] of params.entries()) filters[k] = v;
            const newUrl = await createTimelineShareLink(filters, opts);
            setUrl(newUrl);
            setMode("showing");
            return newUrl;
          }}
        />
      )}
    </div>
  );
}

function ShowingResult({
  url,
  copied,
  onCopy,
  onClose,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const t = useT();
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
          onClick={onCopy}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
        >
          {copied ? t("share_button.copied") : t("share_button.copy")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1"
          title={t("common.close")}
        >
          ✕
        </button>
      </div>
      <p className="text-[10px] text-zinc-500">{t("timeline_share.note")}</p>
    </div>
  );
}
