"use client";

// Dropdown that lists the user's saved views for a given page scope and
// offers an "Uložit aktuální" action. Lives inside the FilterBar.
//
// Saved-view = a named bookmark of URL filter params (q, country, chain,
// runState, approval, missingSpot, tag, …). Canonical allowlist lives in
// app/saved-views/actions.ts. Click loads it via router.push, so it
// behaves identically to navigating to a typed URL.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createSavedView,
  deleteSavedView,
} from "@/app/saved-views/actions";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";

export type SavedView = {
  id: number;
  name: string;
  payload: Record<string, string>;
};

type Props = {
  scope: "timeline" | "campaigns";
  /** Path to navigate to when applying a view. Same scope as `scope` arg. */
  destinationPath: string;
  views: SavedView[];
};

export function SavedViewsMenu({ scope, destinationPath, views }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const { confirm, prompt, toast } = useDialog();
  const t = useT();

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onAway(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function applyView(v: SavedView) {
    const sp = new URLSearchParams();
    for (const [k, val] of Object.entries(v.payload)) {
      if (typeof val === "string" && val) sp.set(k, val);
    }
    setOpen(false);
    startTransition(() => {
      router.push(`${destinationPath}?${sp.toString()}`);
    });
  }

  async function saveCurrent() {
    // Only save if there's actually something to save — empty filter state
    // is a meaningless "saved view".
    const entries: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (v) entries[k] = v;
    }
    if (Object.keys(entries).length === 0) {
      toast.error(
        "Není co uložit. Nejdřív nastav filtry (vyhledávání, stát, řetězec…)."
      );
      return;
    }
    setOpen(false);
    const name = await prompt({
      title: "Pojmenovat pohled",
      message: "Pohled si zapamatuje aktuálně nastavené filtry.",
      placeholder: "např. CZ + SK aktivní",
      confirmLabel: "Uložit",
      validate: (v) => (v.trim() ? null : "Název nesmí být prázdný"),
    });
    if (!name) return;
    startTransition(async () => {
      try {
        await createSavedView(name, scope, entries);
        toast.success("Pohled uložen");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Uložení pohledu selhalo");
      }
    });
  }

  async function removeView(v: SavedView) {
    const ok = await confirm({
      title: `Smazat pohled „${v.name}"?`,
      message: "Tahle akce je nevratná. Filtry se nesmažou, jen jejich uložené pojmenování.",
      confirmLabel: "Smazat",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteSavedView(v.id);
        toast.success("Pohled smazán");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Smazání pohledu selhalo");
      }
    });
  }

  // Highlight a saved view if its payload exactly matches current URL params.
  // This is best-effort: we compare only the keys that the view stores.
  const activeId = (() => {
    for (const v of views) {
      const keys = Object.keys(v.payload);
      if (keys.length === 0) continue;
      const matches = keys.every((k) => searchParams.get(k) === v.payload[k]);
      if (matches) return v.id;
    }
    return null;
  })();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={
          "rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1 " +
          (activeId !== null ? "ring-1 ring-blue-400" : "")
        }
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("filter.saved_views")}
      >
        <span className="text-xs">★</span>
        {t("filter.saved_views")}
        {views.length > 0 && (
          <span className="text-xs text-zinc-500 ml-1">({views.length})</span>
        )}
        <span aria-hidden className="text-zinc-400 text-[10px] ml-0.5">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-40 top-full left-0 mt-1 w-72 rounded-md bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-lg overflow-hidden"
        >
          {views.length === 0 ? (
            <div className="px-3 py-3 text-xs text-zinc-500">
              Zatím žádné uložené pohledy. Nastav filtry a klikni „Uložit
              aktuální".
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {views.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-1 hover:bg-zinc-50 dark:hover:bg-zinc-950"
                >
                  <button
                    type="button"
                    onClick={() => applyView(v)}
                    className={
                      "flex-1 text-left px-3 py-2 text-sm truncate " +
                      (v.id === activeId
                        ? "font-medium text-blue-700 dark:text-blue-400"
                        : "")
                    }
                    title={summarizePayload(v.payload)}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeView(v)}
                    className="text-xs text-zinc-400 hover:text-red-600 px-2 py-1"
                    title="Smazat"
                    aria-label={`Smazat pohled ${v.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
            <button
              type="button"
              onClick={saveCurrent}
              disabled={isPending}
              className="w-full text-left px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50"
            >
              {t("filter.save_current")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Short tooltip blurb showing what filters a view contains. */
function summarizePayload(payload: Record<string, string>): string {
  const labels: Record<string, string> = {
    q: "hledání",
    country: "stát",
    chain: "řetězec",
    runState: "stav",
    approval: "schválení",
    missingSpot: "bez spotu",
    tag: "štítek",
    from: "od",
    to: "do",
  };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (!v) continue;
    parts.push(`${labels[k] ?? k}: ${v}`);
  }
  return parts.join(" · ") || "(prázdné)";
}
