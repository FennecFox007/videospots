"use client";

// Dismissible "drag = posun, klik = otevřít detail …" hint above the
// timeline. Useful on first visit, dead weight after a week.
// Persistence: localStorage flag `videospots:dismissed:timeline-tip`.
// To bring it back, clear that key in DevTools — there's no in-app
// undo on purpose; the tip is supposed to fade once you've internalised
// the gestures.
//
// SSR-safe: starts in "show" state on first render so the markup matches
// what the server emits, then a useEffect reads localStorage and hides
// if dismissed. Brief flash on first paint is acceptable for this kind
// of nudge.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

const STORAGE_KEY = "videospots:dismissed:timeline-tip";

export function TimelineTip() {
  const t = useT();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setHidden(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — keep visible.
    }
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — at worst the tip reappears next visit
    }
  }

  if (hidden) return null;

  return (
    <p className="text-xs text-zinc-500 flex items-start gap-2">
      <span className="flex-1">
        <span className="font-medium">{t("common.tip")}:</span>{" "}
        {t("timeline.tip")}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        className="shrink-0 -my-0.5 px-1 py-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title={t("common.close")}
      >
        ✕
      </button>
    </p>
  );
}
