"use client";

// Bell-icon dropdown in the nav. Shows the last ~10 audit-log entries.
// Closes on click outside; "Show all" link takes the user to /admin/audit.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatRelative } from "@/lib/utils";

export type ActivityEntry = {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  userName: string | null;
  userEmail: string | null;
  campaignName: string | null;
  createdAt: Date;
};

const ACTION_VERB: Record<string, string> = {
  created: "vytvořil(a)",
  updated: "upravil(a)",
  deleted: "smazal(a)",
  cancelled: "zrušil(a)",
};

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // "New" badge = entries from the last 24 h.
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const newCount = entries.filter(
    (e) => new Date(e.createdAt).getTime() > since
  ).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative px-2 py-1 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        aria-label="Aktivita"
        aria-expanded={open}
      >
        <span aria-hidden>🔔</span>
        {newCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
            {newCount > 9 ? "9+" : newCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1rem)] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Aktivita
          </div>

          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Žádná aktivita.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-sm"
                >
                  <ActivityRow entry={e} onNavigate={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/admin/audit"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-blue-600 dark:text-blue-400 px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950"
          >
            Zobrazit kompletní audit log →
          </Link>
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  entry,
  onNavigate,
}: {
  entry: ActivityEntry;
  onNavigate: () => void;
}) {
  const verb = ACTION_VERB[entry.action] ?? entry.action;
  const who = entry.userName ?? entry.userEmail ?? "kdosi";
  const isCampaign = entry.entity === "campaign" && entry.entityId;

  const target =
    isCampaign && entry.campaignName ? (
      <Link
        href={`/campaigns/${entry.entityId}`}
        onClick={onNavigate}
        className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
      >
        {entry.campaignName}
      </Link>
    ) : (
      <span className="text-zinc-500">
        {entry.entity}
        {entry.entityId ? ` #${entry.entityId}` : ""}
      </span>
    );

  return (
    <div>
      <div className="text-zinc-700 dark:text-zinc-300">
        <span className="font-medium">{who}</span>{" "}
        <span className="text-zinc-500">{verb}</span> {target}
      </div>
      <div className="text-xs text-zinc-500 mt-0.5">
        {formatRelative(new Date(entry.createdAt))}
      </div>
    </div>
  );
}
