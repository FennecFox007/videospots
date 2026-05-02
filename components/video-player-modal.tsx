"use client";

// Centered modal that plays a campaign's video spot. Opened from the play
// button on timeline bars. Same look-and-feel as RouteModal but controlled
// imperatively (no router involvement) — closing is just `onClose()`.
//
// Auto-plays the video on open: the user clicked play, that's the explicit
// intent. ESC, click on backdrop, or X button close.

import { useEffect, useRef } from "react";
import { VideoEmbed } from "@/components/video-embed";

type Props = {
  url: string;
  title: string;
  onClose: () => void;
};

export function VideoPlayerModal({ url, title, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC closes.
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

  // Body scroll lock so wheel inside modal doesn't drift the page underneath.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus the dialog wrapper on mount so subsequent Tab navigation starts
  // inside the modal (close button, video controls).
  useEffect(() => {
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-4xl bg-zinc-900 rounded-lg shadow-2xl ring-1 ring-zinc-700 outline-none overflow-hidden"
      >
        <header className="flex items-center justify-between gap-4 px-4 py-2.5 bg-zinc-950/60">
          <h2
            id="video-modal-title"
            className="text-sm font-medium text-zinc-100 truncate"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="shrink-0 -m-1 p-1 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors"
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
        <div className="bg-black">
          <VideoEmbed url={url} autoplay />
        </div>
      </div>
    </div>
  );
}
