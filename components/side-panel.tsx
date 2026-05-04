"use client";

// Right-side peek panel for routes opened via Next's intercepting-route slot.
// Compared to <RouteModal> (centered overlay):
//  - Anchored to the right edge on sm+, slides in
//  - Full-screen drawer on mobile (< sm)
//  - Backdrop is clickable to close, but doesn't dim as heavily — the user
//    is still meant to see the timeline behind it
//  - ESC closes via router.back() (whichever URL they came from)
//
// Used by app/@modal/(.)campaigns/[id]/page.tsx for the campaign peek
// experience: click a bar in timeline → URL changes to /campaigns/<id> →
// this slot renders → user sees a side-panel preview without losing the
// timeline state underneath.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  /** Optional sub-text under the title (e.g. status badges row). */
  subtitle?: React.ReactNode;
  /** Buttons rendered in the sticky footer. */
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function SidePanel({ title, subtitle, footer, children }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // ESC closes via router.back(). Capture phase so embedded inputs don't
  // intercept it for their own purposes (e.g., clearing a select).
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

  // Lock body scroll on mobile (where the panel covers the viewport).
  // On desktop the panel is to the side and the page can keep scrolling
  // independently — but locking is cleaner there too, since wheel inside
  // panel shouldn't drift the timeline behind.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus restore on close.
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
    <div
      // Wrapper covers viewport for click-out-to-close detection. Backdrop
      // is lighter than the modal's — the user should still perceive the
      // timeline underneath as the "main thing".
      className="fixed inset-0 z-[80] flex justify-end bg-black/20 sm:bg-transparent print:hidden"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="side-panel-title"
        tabIndex={-1}
        className={
          // Mobile: full-screen drawer. Desktop: anchored right, ~480 px wide,
          // separated from timeline by a soft shadow/ring on the left edge.
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
              className="text-base font-semibold tracking-tight"
            >
              {title}
            </h2>
            {subtitle && <div className="mt-1.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Zavřít"
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
