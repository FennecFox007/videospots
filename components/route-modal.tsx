"use client";

// Generic modal shell for routes opened via Next's intercepting-route pattern
// (app/@modal/(.)foo/page.tsx). On large screens it's a centered dialog with
// a max-width; on mobile it's full-screen so long forms aren't cramped.
//
// Closing is always navigation: ESC, click-outside, or the X button calls
// router.back(). The modal closing IS the back navigation, so URL state stays
// correct (refresh on the intercepted URL falls back to the standalone page).

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Props = {
  title: string;
  /** Optional sub-text under the title (e.g. context hint about prefill). */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
};

export function RouteModal({ title, subtitle, children }: Props) {
  const router = useRouter();
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Close on ESC. Capture phase so any inline form / focused input doesn't
  // intercept it for their own purposes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        router.back();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  // Lock body scroll while the modal is open. Without this, two scrollbars
  // appear and the page underneath drifts as you wheel inside the modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus the modal on mount so keyboard nav starts inside it; restore focus
  // on unmount so closing the modal returns the user to where they were.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    // Defer slightly so the form inputs render first; focusing the wrapper
    // is enough — the user's first Tab moves into the form normally.
    const t = setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      const prev = previouslyFocusedRef.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  return (
    <div
      // Fixed full-viewport overlay. z-index above sticky timeline header
      // (z-30) and ContextMenu (z-50 in some places) but below toast/alert if
      // we ever add one (reserve z-100+).
      className="fixed inset-0 z-[80] flex items-stretch sm:items-start sm:justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        // Click on the backdrop itself (not bubbling from inside) closes.
        if (e.target === e.currentTarget) router.back();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-modal-title"
        tabIndex={-1}
        className={
          // Mobile: full-screen sheet. Desktop: centered card with max width
          // and breathing room. Internal scroll keeps long forms usable.
          "relative w-full sm:my-8 sm:max-w-3xl sm:rounded-lg " +
          "bg-white dark:bg-zinc-900 shadow-xl outline-none " +
          "max-h-screen sm:max-h-[calc(100vh-4rem)] " +
          "flex flex-col overflow-hidden"
        }
      >
        <header className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <div className="min-w-0">
            <h2
              id="route-modal-title"
              className="text-lg font-semibold tracking-tight truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t("common.close")}
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

        <div className="overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
