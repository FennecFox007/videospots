"use client";

// Right-side peek panel — generic shell. The campaign-specific wrapper is
// <CampaignPeek />, which feeds children + onClose into this.
//
// Behavior:
// - Anchored to the right edge on sm+; full-screen drawer on < sm
// - Backdrop visible but light — the user is supposed to see the timeline
//   behind the panel as the "main thing", and click out to close
// - ESC closes (capture phase, so embedded inputs don't swallow it)
// - Body scroll locked while the panel is open
// - aria-modal="false" intentionally — focus is NOT trapped, the user can
//   tab back to the timeline behind without closing

import { useEffect, useRef } from "react";

type Props = {
  title: string;
  /** Optional sub-text under the title (e.g. status badges row). */
  subtitle?: React.ReactNode;
  /** Buttons rendered in the sticky footer. */
  footer?: React.ReactNode;
  /** Called when ESC / X / click-outside fires. */
  onClose: () => void;
  /** Localised aria-label for the X button (we have no router-back here, the
   *  panel doesn't know which language the rest of the page is in). */
  closeLabel?: string;
  children: React.ReactNode;
};

export function SidePanel({
  title,
  subtitle,
  footer,
  onClose,
  closeLabel = "Zavřít",
  children,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // ESC to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open. Restored to whatever it was on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Capture which element was focused before the panel opened, so we can
  // hand focus back when it closes.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      const prev = previouslyFocusedRef.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  return (
    // z-[70] sits between toolbar drawers (z-[60]) and modals (z-[80]),
    // so a confirm dialog opened from inside the peek (e.g. cancel campaign)
    // renders on top of it instead of being clipped underneath. See
    // STAV.md "Tier 5 — z-index hierarchy" for the canonical layering.
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/20 sm:bg-transparent print:hidden"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="side-panel-title"
        tabIndex={-1}
        className={
          // Mobile: full-screen drawer. Desktop: anchored right, ~480 px wide.
          "relative h-full w-full sm:w-[480px] sm:max-w-[45vw] " +
          "bg-white dark:bg-zinc-900 outline-none " +
          "shadow-2xl sm:ring-1 sm:ring-zinc-200/60 sm:dark:ring-zinc-800/60 " +
          "flex flex-col overflow-hidden " +
          "animate-in slide-in-from-right duration-200"
        }
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <div className="min-w-0 flex-1">
            <h2
              id="side-panel-title"
              className="text-base font-semibold tracking-tight truncate"
              title={title}
            >
              {title}
            </h2>
            {subtitle && <div className="mt-1.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="shrink-0 -m-1 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>

        {footer && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 bg-white dark:bg-zinc-900 flex flex-wrap items-center gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
