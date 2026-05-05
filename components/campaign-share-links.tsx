"use client";

// Per-campaign share-link management. Listed below the create button on
// /campaigns/[id]: shows currently-active links + the most recent revoked
// /expired ones (collapsed under a toggle so the section doesn't grow
// unbounded). Each row exposes Copy / Extend / Revoke actions.
//
// Server fetches the rows fresh on each render — the create surface
// (<ShareButton>) calls router.refresh() on success so we re-render with
// the new row included. Revoke/extend mutations also revalidatePath the
// detail, so this component doesn't need its own fetch loop.

import { useState, useTransition } from "react";
import {
  revokeShareLink,
  extendShareLink,
} from "@/app/campaigns/[id]/actions";
import { useT } from "@/lib/i18n/client";
import { Pill } from "@/components/ui/pill";
import { useRouter } from "next/navigation";

export type CampaignShareLinkRow = {
  id: number;
  token: string;
  label: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedByName: string | null;
  createdAt: Date;
  createdByName: string | null;
};

type Status = "active" | "expired" | "revoked";

function statusOf(row: CampaignShareLinkRow, now: Date): Status {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && row.expiresAt <= now) return "expired";
  return "active";
}

export function CampaignShareLinks({
  rows,
  origin,
}: {
  rows: CampaignShareLinkRow[];
  /** Pre-computed `${proto}://${host}` from the server, so client clipboard
   *  copy works even before any user interaction (window.location is fine
   *  in browsers but server-rendered URL needs an explicit origin). */
  origin: string;
}) {
  const t = useT();
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const now = new Date();
  const active = rows.filter((r) => statusOf(r, now) === "active");
  const inactive = rows.filter((r) => statusOf(r, now) !== "active");

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">{t("share_links.empty")}</p>
    );
  }

  function urlFor(row: CampaignShareLinkRow) {
    return `${origin}/share/${row.token}`;
  }

  async function copy(row: CampaignShareLinkRow) {
    const url = urlFor(row);
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
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1500);
  }

  function revoke(row: CampaignShareLinkRow) {
    if (!confirm(t("share_links.revoke_confirm"))) return;
    setPendingId(row.id);
    startTransition(async () => {
      try {
        await revokeShareLink(row.id);
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  function extend(row: CampaignShareLinkRow) {
    setPendingId(row.id);
    startTransition(async () => {
      try {
        await extendShareLink(row.id, 30);
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      {active.length > 0 && (
        <ul className="space-y-1.5">
          {active.map((row) => (
            <ShareLinkRow
              key={row.id}
              row={row}
              status="active"
              isPending={pendingId === row.id}
              isCopied={copiedId === row.id}
              urlFor={urlFor}
              onCopy={() => copy(row)}
              onExtend={() => extend(row)}
              onRevoke={() => revoke(row)}
            />
          ))}
        </ul>
      )}

      {active.length === 0 && (
        <p className="text-sm text-zinc-500">{t("share_links.no_active")}</p>
      )}

      {inactive.length > 0 && (
        <details
          open={showInactive}
          onToggle={(e) => setShowInactive((e.target as HTMLDetailsElement).open)}
          className="pt-1"
        >
          <summary className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer select-none">
            {t("share_links.show_inactive", { n: inactive.length })}
          </summary>
          <ul className="space-y-1.5 mt-2">
            {inactive.map((row) => (
              <ShareLinkRow
                key={row.id}
                row={row}
                status={statusOf(row, now)}
                isPending={pendingId === row.id}
                isCopied={copiedId === row.id}
                urlFor={urlFor}
                onCopy={() => copy(row)}
                onExtend={null}
                onRevoke={null}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ShareLinkRow({
  row,
  status,
  isPending,
  isCopied,
  urlFor,
  onCopy,
  onExtend,
  onRevoke,
}: {
  row: CampaignShareLinkRow;
  status: Status;
  isPending: boolean;
  isCopied: boolean;
  urlFor: (row: CampaignShareLinkRow) => string;
  onCopy: () => void;
  /** Null = action not available for this row (inactive links). */
  onExtend: (() => void) | null;
  onRevoke: (() => void) | null;
}) {
  const t = useT();

  return (
    <li className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40 px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
      <Pill
        size="xs"
        tone={
          status === "active"
            ? "emerald"
            : status === "expired"
              ? "amber"
              : "zinc"
        }
      >
        {t(
          status === "active"
            ? "share_links.status.active"
            : status === "expired"
              ? "share_links.status.expired"
              : "share_links.status.revoked"
        )}
      </Pill>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          {row.label ? (
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.label}
            </span>
          ) : (
            <span className="font-mono text-xs text-zinc-500">
              {row.token.slice(0, 8)}…
            </span>
          )}
          <span className="text-xs text-zinc-500">
            {status === "revoked" && row.revokedAt
              ? t("share_links.revoked_at", {
                  date: formatShort(row.revokedAt),
                  by: row.revokedByName ?? "?",
                })
              : status === "expired" && row.expiresAt
                ? t("share_links.expired_at", {
                    date: formatShort(row.expiresAt),
                  })
                : row.expiresAt
                  ? t("share_links.expires_at", {
                      date: formatShort(row.expiresAt),
                    })
                  : t("share_links.no_expiry")}
          </span>
        </div>
        <div className="text-[10px] text-zinc-400">
          {t("share_links.created_at", {
            date: formatShort(row.createdAt),
            by: row.createdByName ?? "?",
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onCopy}
          className={
            "text-xs px-2 py-1 rounded-md border " +
            (isCopied
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900")
          }
          title={urlFor(row)}
        >
          {isCopied
            ? t("share_button.copied")
            : t("share_links.action.copy")}
        </button>

        {onExtend && (
          <button
            type="button"
            onClick={onExtend}
            disabled={isPending}
            className="text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
            title={t("share_links.action.extend_tooltip")}
          >
            {t("share_links.action.extend")}
          </button>
        )}

        {onRevoke && (
          <button
            type="button"
            onClick={onRevoke}
            disabled={isPending}
            className="text-xs px-2 py-1 rounded-md border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            {t("share_links.action.revoke")}
          </button>
        )}
      </div>
    </li>
  );
}

function formatShort(d: Date): string {
  // Quick CZ-style "5. 5. 2026" without pulling a date lib client-side. The
  // detail page already renders other dates this way (no time, just date).
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}. ${month}. ${year}`;
}
