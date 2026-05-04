"use client";

// Light/dark theme toggle. The dark class on <html> is set server-side from
// a cookie (see lib/theme/server.ts + app/layout.tsx). This button writes
// the new value via a server action and asks the router to refresh, so the
// layout re-renders with the right class. No localStorage, no inline init
// script, no FOUC.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTheme } from "@/app/actions/set-theme";

type Props = {
  /** Current theme, passed down from the server-rendered layout. The
   *  toggle uses this for both its initial label/icon and to know which
   *  value to flip to. */
  current: "light" | "dark";
};

export function DarkModeToggle({ current }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isDark = current === "dark";

  function toggle() {
    const next = isDark ? "light" : "dark";
    startTransition(async () => {
      await setTheme(next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={
        isDark ? "Přepnout na světlý motiv" : "Přepnout na tmavý motiv"
      }
      title={isDark ? "Světlý motiv" : "Tmavý motiv"}
      className="px-2 py-1 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
    >
      <span aria-hidden className="text-base leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
