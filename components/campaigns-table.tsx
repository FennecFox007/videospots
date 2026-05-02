"use client";

// Selectable table on /campaigns. Maintains a Set<number> of selected campaign
// ids and shows a sticky bulk-action bar when ≥1 row is selected. Sorting
// remains URL-driven (server-side); selection is purely client state and
// resets on page navigation.

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  bulkArchiveCampaigns,
  bulkCancelCampaigns,
  bulkChangeColor,
} from "@/app/campaigns/bulk-actions";
import { CAMPAIGN_COLORS } from "@/lib/colors";
import {
  formatDate,
  daysBetween,
  pluralCs,
  computedRunState,
} from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { CommunicationBadge } from "@/components/communication-badge";
import { kindEmoji, kindLabel } from "@/lib/products";

export type CampaignsTableRow = {
  id: number;
  name: string;
  client: string | null;
  productName: string | null;
  productKind: string | null;
  color: string;
  status: string;
  communicationType: string | null;
  startsAt: Date;
  endsAt: Date;
  channelCount: number;
  tags: string[] | null;
};

type SearchParamsLike = Record<string, string | undefined>;

type Props = {
  rows: CampaignsTableRow[];
  /** Current URL params, used to construct sort header links. */
  params: SearchParamsLike;
  sort: string;
  order: string;
};

export function CampaignsTable({ rows, params, sort, order }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const allIds = rows.map((r) => r.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = !allSelected && allIds.some((id) => selected.has(id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      allSelected ? new Set() : new Set(allIds)
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function runBulk(fn: () => Promise<void>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      await fn();
      setSelected(new Set());
      setColorPickerOpen(false);
    });
  }

  const ids = Array.from(selected);
  const count = ids.length;

  return (
    <>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Vybrat vše"
                  className="rounded"
                />
              </th>
              <th className="px-3 py-2 font-medium w-6"></th>
              <SortHeader label="Kampaň" sortKey="name" sort={sort} order={order} params={params} />
              <SortHeader label="Klient" sortKey="client" sort={sort} order={order} params={params} />
              <th className="px-3 py-2 font-medium">Produkt</th>
              <SortHeader label="Začátek" sortKey="starts" sort={sort} order={order} params={params} />
              <SortHeader label="Délka" sortKey="duration" sort={sort} order={order} params={params} />
              <th className="px-3 py-2 font-medium text-right">Kanály</th>
              <SortHeader label="Stav" sortKey="status" sort={sort} order={order} params={params} />
              <th className="px-3 py-2 font-medium">Štítky</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOn = selected.has(r.id);
              const dur = daysBetween(r.startsAt, r.endsAt);
              const runState = computedRunState(r);
              return (
                <tr
                  key={r.id}
                  className={
                    "border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50 " +
                    (isOn ? "bg-blue-50/40 dark:bg-blue-950/20" : "")
                  }
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggle(r.id)}
                      aria-label={`Vybrat ${r.name}`}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800"
                      style={{ background: r.color }}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/campaigns/${r.id}`}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {r.client ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {r.productName ? (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden title={kindLabel(r.productKind ?? "game")}>
                          {kindEmoji(r.productKind ?? "game")}
                        </span>
                        {r.productName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(r.startsAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {dur} {pluralCs(dur, "den", "dny", "dní")}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {r.channelCount}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={r.status} runState={runState} />
                      <CommunicationBadge type={r.communicationType} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {r.tags && r.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  Žádné kampaně neodpovídají filtrům.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sticky bulk action bar */}
      {count > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 flex items-center gap-2 text-sm">
          <span className="font-medium">
            {count} {pluralCs(count, "vybraná", "vybrané", "vybraných")}
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>

          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runBulk(
                () => bulkCancelCampaigns(ids),
                `Zrušit ${count} ${pluralCs(count, "kampaň", "kampaně", "kampaní")}?`
              )
            }
            className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50"
          >
            Zrušit (historicky)
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setColorPickerOpen((v) => !v)}
              disabled={isPending}
              className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Barva ▾
            </button>
            {colorPickerOpen && (
              <div className="absolute bottom-full left-0 mb-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-2 flex gap-1">
                {CAMPAIGN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() =>
                      runBulk(() => bulkChangeColor(ids, c.value))
                    }
                    title={c.name}
                    className="w-6 h-6 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700 hover:scale-110 transition-transform"
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runBulk(
                () => bulkArchiveCampaigns(ids),
                `Archivovat ${count} ${pluralCs(count, "kampaň", "kampaně", "kampaní")}? Půjde obnovit z /admin/archive.`
              )
            }
            className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 dark:border-red-900 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            Archivovat
          </button>

          <span className="text-zinc-300 dark:text-zinc-700 ml-1">·</span>

          <button
            type="button"
            onClick={clearSelection}
            disabled={isPending}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            aria-label="Zrušit výběr"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  order,
  params,
}: {
  label: string;
  sortKey: string;
  sort: string;
  order: string;
  params: SearchParamsLike;
}) {
  const active = sort === sortKey;
  const nextOrder = active && order === "desc" ? "asc" : "desc";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) sp.set(k, v);
  }
  sp.set("sort", sortKey);
  sp.set("order", nextOrder);
  return (
    <th className="px-3 py-2 font-medium">
      <Link
        href={`?${sp.toString()}`}
        className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {label}
        {active && (
          <span className="text-[10px]">{order === "asc" ? "▲" : "▼"}</span>
        )}
      </Link>
    </th>
  );
}
