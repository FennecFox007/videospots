"use client";

// Toolbar button + right-side slide-out drawer that lists every spot in
// the library, grouped by country. Each card is HTML5-draggable; dropping
// one onto a Timeline channel row opens the create-campaign modal
// (components/spot-drop-modal.tsx) via lib/spot-drop-store.
//
// The button + the drawer are rendered together by the same component so
// the open-state lives in one place. The button slot in the toolbar gets
// just <button>; the drawer panel renders fixed-position when open.
//
// Default landing tab is "Nenasazené" — same partner-driven priority as
// the /spots admin page. Search filters within the active tab. Lots-of-
// spots scenario handled via:
//   - tab default hides anything already running
//   - free-text search across spot name / product / video URL
//   - country sections collapse independently
// so even with 100s of spots the drawer stays readable.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DrawerSpot } from "@/lib/db/queries";
import {
  SPOT_DRAG_MIME,
  type SpotDragPayload,
} from "@/lib/spot-drop-store";
import { useT } from "@/lib/i18n/client";
import { localizedCountryName } from "@/lib/i18n/country";

type View = "undeployed" | "all";

export function SpotsDrawer({ spots }: { spots: DrawerSpot[] }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("undeployed");
  const [query, setQuery] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const t = useT();

  // Click-outside / ESC close. Body scroll-lock skipped — the drawer is
  // narrow enough that the timeline scroll behind it stays useful.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onAway(e: MouseEvent) {
      if (!drawerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onAway);
    };
  }, [open]);

  const undeployedCount = spots.filter((s) => s.deployments === 0).length;

  // Filter spots by tab + search. Group into country sections.
  const groups = useMemo(() => {
    const filtered = spots.filter((s) => {
      if (view === "undeployed" && s.deployments > 0) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const haystack = [
        s.name,
        s.productName,
        s.videoUrl,
        s.countryCode,
        s.countryName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const byCountry = new Map<string, { name: string; flag: string | null; code: string; spots: DrawerSpot[] }>();
    for (const s of filtered) {
      const key = String(s.countryId);
      if (!byCountry.has(key)) {
        byCountry.set(key, {
          name: s.countryName,
          flag: s.countryFlag,
          code: s.countryCode,
          spots: [],
        });
      }
      byCountry.get(key)!.spots.push(s);
    }
    return Array.from(byCountry.values());
  }, [spots, view, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 transition-colors"
        title={t("spots_drawer.button_tooltip")}
      >
        <span aria-hidden>📺</span>
        {t("spots_drawer.button")}
        {undeployedCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1"
            aria-label={t("spots_drawer.undeployed_count", {
              count: undeployedCount,
            })}
          >
            {undeployedCount > 9 ? "9+" : undeployedCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={drawerRef}
          className="fixed top-0 right-0 bottom-0 w-[320px] bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-200 print:hidden"
          role="dialog"
          aria-label={t("spots_drawer.aria_label")}
        >
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold">
                {t("spots_drawer.heading")}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t("spots_drawer.hint")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="-m-1 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("spots_drawer.search_placeholder")}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden text-xs w-full">
              <ViewTab
                current={view}
                target="undeployed"
                label={t("spots_drawer.tab.undeployed")}
                onClick={() => setView("undeployed")}
              />
              <ViewTab
                current={view}
                target="all"
                label={t("spots_drawer.tab.all")}
                onClick={() => setView("all")}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {groups.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-500">
                {view === "undeployed"
                  ? t("spots_drawer.empty.undeployed")
                  : t("spots_drawer.empty.all")}
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.code} className="mb-3 last:mb-0">
                  <h3 className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-zinc-500 flex items-center gap-1.5">
                    <span aria-hidden>{g.flag}</span>
                    {localizedCountryName(g.code, g.name, t.locale)}
                    <span className="text-zinc-400 font-normal">
                      ({g.spots.length})
                    </span>
                  </h3>
                  <ul>
                    {g.spots.map((s) => (
                      <SpotCard key={s.id} spot={s} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          <footer className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 flex items-center justify-between gap-2">
            <span>{t("spots_drawer.footer_hint")}</span>
            <Link
              href="/spots/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {t("spots_drawer.new_link")}
            </Link>
          </footer>
        </div>
      )}
    </>
  );
}

function ViewTab({
  current,
  target,
  label,
  onClick,
}: {
  current: View;
  target: View;
  label: string;
  onClick: () => void;
}) {
  const active = current === target;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 px-3 py-1.5 transition-colors " +
        (active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800") +
        (target === "undeployed"
          ? " border-r border-zinc-300 dark:border-zinc-700"
          : "")
      }
    >
      {label}
    </button>
  );
}

function SpotCard({ spot }: { spot: DrawerSpot }) {
  const t = useT();
  const label = spot.name
    ? spot.name
    : spot.productName
      ? `${spot.productName} · ${spot.countryCode}`
      : `Spot · ${spot.countryCode}`;

  function onDragStart(e: React.DragEvent) {
    const payload: SpotDragPayload = {
      spotId: spot.id,
      spotName: label,
      spotProductName: spot.productName,
      countryId: spot.countryId,
      countryCode: spot.countryCode,
      countryFlag: spot.countryFlag,
      countryName: spot.countryName,
    };
    // Two MIME types: our custom one for the actual payload, and the
    // generic text/plain so the browser shows a sensible drag preview if
    // any other surface accepts text drops.
    e.dataTransfer.setData(SPOT_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.setData("text/plain", label);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <li
      draggable
      onDragStart={onDragStart}
      className="group rounded-md px-2 py-1.5 mb-1 cursor-grab active:cursor-grabbing hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      title={t("spots_drawer.card_drag_hint")}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="text-zinc-300 dark:text-zinc-600 select-none cursor-grab"
        >
          ⋮⋮
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
            {spot.deployments > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                {spot.deployments}× {t.plural(spot.deployments, "unit.campaign")}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                {t("spots_drawer.undeployed")}
              </span>
            )}
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <a
              href={spot.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline truncate"
            >
              {spot.videoUrl}
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
