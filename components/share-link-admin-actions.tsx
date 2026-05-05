"use client";

// Per-row action cluster on /admin/share-links: Copy / Extend / Revoke.
// Mirrors the affordances in <CampaignShareLinks> but server-rendered into
// a table cell, so we keep it small and stateless besides the transient
// "copied" + "pending" flags.
//
// The page itself is admin-only (gated in /admin layout). These actions
// hit `requireEditor`, so admins always pass; we don't gate the buttons
// further client-side.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  revokeShareLink,
  extendShareLink,
} from "@/app/campaigns/[id]/actions";
import { useT } from "@/lib/i18n/client";

export function ShareLinkAdminActions({
  linkId,
  url,
  canExtend,
  canRevoke,
}: {
  linkId: number;
  url: string;
  canExtend: boolean;
  canRevoke: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke() {
    if (!confirm(t("share_links.revoke_confirm"))) return;
    startTransition(async () => {
      await revokeShareLink(linkId);
      router.refresh();
    });
  }

  function extend() {
    startTransition(async () => {
      await extendShareLink(linkId, 30);
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={copy}
        title={url}
        className={
          "text-xs px-2 py-1 rounded-md border " +
          (copied
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900")
        }
      >
        {copied ? t("share_button.copied") : t("share_links.action.copy")}
      </button>

      {canExtend && (
        <button
          type="button"
          onClick={extend}
          disabled={isPending}
          title={t("share_links.action.extend_tooltip")}
          className="text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
        >
          {t("share_links.action.extend")}
        </button>
      )}

      {canRevoke && (
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="text-xs px-2 py-1 rounded-md border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
        >
          {t("share_links.action.revoke")}
        </button>
      )}
    </div>
  );
}
