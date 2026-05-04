"use client";

// Dialog for editing the per-channel override of a single (campaign × channel)
// pair. Opened from the timeline bar's right-click menu ("Upravit jen tento
// řetězec"). Saves through setChannelOverride / clearChannelOverride server
// actions.
//
// UX notes:
//  - Date inputs default to the bar's CURRENT effective dates (whether
//    those are master or already an override). User can change either.
//  - Saving with the same dates as master still records an override —
//    but in practice you'd use "Smazat přepsání" instead.
//  - "Vypnout v tomto řetězci" sets cancelledAt to now; un-checking clears
//    it. Distinct from "Smazat přepsání" which wipes everything (dates
//    + cancellation) back to inherit-master.
//  - Master dates shown read-only at the bottom for reference.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toDateInputValue } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import {
  setChannelOverride,
  clearChannelOverride,
} from "@/app/campaigns/[id]/actions";
import { useDialog } from "@/components/dialog/dialog-provider";

type Props = {
  open: boolean;
  campaignId: number;
  channelId: number;
  /** Used in the dialog header — "Upravit pro <chain> (<country>)". */
  chainName: string;
  countryName: string;
  countryFlag: string | null;
  /** Bar's current effective dates (may be from override or master). */
  effectiveStartsAt: Date;
  effectiveEndsAt: Date;
  /** Master campaign dates, shown for reference. */
  masterStartsAt: Date;
  masterEndsAt: Date;
  /** Whether the channel is currently cancelled. */
  cancelled: boolean;
  /** True if at least one override field is currently set. Toggles
   *  visibility of the "Smazat přepsání" button. */
  hasOverride: boolean;
  onClose: () => void;
};

export function ChannelOverrideDialog({
  open,
  campaignId,
  channelId,
  chainName,
  countryName,
  countryFlag,
  effectiveStartsAt,
  effectiveEndsAt,
  masterStartsAt,
  masterEndsAt,
  cancelled: initialCancelled,
  hasOverride,
  onClose,
}: Props) {
  const t = useT();
  const { toast } = useDialog();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [startsAt, setStartsAt] = useState(toDateInputValue(effectiveStartsAt));
  const [endsAt, setEndsAt] = useState(toDateInputValue(effectiveEndsAt));
  const [cancelled, setCancelled] = useState(initialCancelled);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form whenever the dialog opens with a different bar.
  useEffect(() => {
    if (!open) return;
    setStartsAt(toDateInputValue(effectiveStartsAt));
    setEndsAt(toDateInputValue(effectiveEndsAt));
    setCancelled(initialCancelled);
    setError(null);
  }, [open, effectiveStartsAt, effectiveEndsAt, initialCancelled]);

  // ESC closes; body scroll locked while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    setError(null);
    if (new Date(endsAt) < new Date(startsAt)) {
      setError(t("override.error_end_before_start"));
      return;
    }
    startTransition(async () => {
      try {
        await setChannelOverride(campaignId, channelId, {
          startsAt,
          endsAt,
          cancelled,
        });
        toast.success(t("override.saved"));
        // Refresh server-rendered timeline / detail page so the bar's
        // italic + ✱ marker appears (or its dates change) right away.
        router.refresh();
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleClear = () => {
    setError(null);
    startTransition(async () => {
      try {
        await clearChannelOverride(campaignId, channelId);
        toast.success(t("override.cleared"));
        router.refresh();
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-override-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-2xl ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2
              id="channel-override-title"
              className="text-base font-semibold tracking-tight"
            >
              {t("override.title")}
            </h2>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span aria-hidden>{countryFlag}</span>
              <span>{countryName}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {chainName}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 -m-1 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
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

        <div className="overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/40 rounded-md px-3 py-2">
            {t("override.scope_note")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">
                {t("common.start")}
              </span>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={cancelled || isPending}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">
                {t("common.end")}
              </span>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={cancelled || isPending}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm disabled:opacity-50"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cancelled}
              onChange={(e) => setCancelled(e.target.checked)}
              disabled={isPending}
              className="rounded"
            />
            <span className="text-sm">
              {t("override.cancel_in_channel")}
            </span>
          </label>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <div className="text-xs text-zinc-500 mb-1">
              {t("override.master_dates")}
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">
              {toDateInputValue(masterStartsAt)} →{" "}
              {toDateInputValue(masterEndsAt)}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 flex flex-wrap items-center gap-2">
          {hasOverride && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline disabled:opacity-50"
            >
              {t("override.clear")}
            </button>
          )}
          <span className="ml-auto" />
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-sm px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {isPending ? t("common.loading") : t("common.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
