"use client";

import { useTransition } from "react";
import { useLocale } from "@/lib/i18n/client";
import { setLocale } from "@/app/actions/set-locale";
import { LOCALES } from "@/lib/i18n/messages";

/**
 * Two-state CS / EN toggle in the nav. Calls a server action to persist the
 * choice in a cookie, then layout-revalidates so server-rendered strings
 * update on next paint. Inert while the round-trip is pending.
 */
export function LocaleSwitcher() {
  const current = useLocale();
  const [isPending, startTransition] = useTransition();

  function pick(next: string) {
    if (next === current) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div
      className="inline-flex rounded-md ring-1 ring-zinc-300 dark:ring-zinc-700 overflow-hidden text-xs font-medium"
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((loc, i) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            disabled={isPending}
            onClick={() => pick(loc)}
            className={
              "px-2 py-1 transition-colors uppercase tracking-wide " +
              (active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800") +
              (i === 0 ? "" : " border-l border-zinc-200 dark:border-zinc-700")
            }
            aria-pressed={active}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}
