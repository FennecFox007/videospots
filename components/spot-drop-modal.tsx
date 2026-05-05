"use client";

// Modal that opens after a spot is dropped onto a Timeline channel row.
// Subscribes to spot-drop-store; when setPendingDrop is called from the
// drop handler in Timeline, this modal renders with the drop's metadata
// pre-filled.
//
// User confirms (or adjusts) the campaign name, date range, additional
// channels in the same country, and whether to auto-approve. Submit calls
// createCampaignFromSpot and clears the store on success.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearPendingDrop,
  getPendingDrop,
  subscribePendingDrop,
  type PendingDrop,
} from "@/lib/spot-drop-store";
import { createCampaignFromSpot } from "@/app/spots/actions";
import { addDays, toDateInputValue } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { useDialog } from "@/components/dialog/dialog-provider";

/** Channels grouped by country — same shape as the timeline gets so we can
 *  render the "other channels in this country" checkbox list. */
export type DropModalGroup = {
  countryId: number;
  channels: Array<{ id: number; chainName: string }>;
};

const DEFAULT_DURATION_DAYS = 14;

export function SpotDropModal({
  groupsByCountry,
}: {
  groupsByCountry: DropModalGroup[];
}) {
  const [pending, setPending] = useState<PendingDrop | null>(getPendingDrop());
  const t = useT();
  const router = useRouter();
  const { toast } = useDialog();

  useEffect(() => subscribePendingDrop(setPending), []);

  if (!pending) return null;

  // Find all channels in the dropped country — drives the "other channels"
  // checkbox list. The dropped channel is pre-checked; siblings start
  // unchecked so the user explicitly opts in.
  const channelsInCountry =
    groupsByCountry.find((g) => g.countryId === pending.countryId)
      ?.channels ?? [];

  return (
    <ModalBody
      key={pending.spotId + ":" + pending.channelId}
      pending={pending}
      channelsInCountry={channelsInCountry}
      t={t}
      router={router}
      toast={toast}
    />
  );
}

function ModalBody({
  pending,
  channelsInCountry,
  t,
  router,
  toast,
}: {
  pending: PendingDrop;
  channelsInCountry: Array<{ id: number; chainName: string }>;
  t: ReturnType<typeof useT>;
  router: ReturnType<typeof useRouter>;
  toast: ReturnType<typeof useDialog>["toast"];
}) {
  const [name, setName] = useState(
    pending.spotProductName ?? pending.spotName
  );
  const [startsAt, setStartsAt] = useState(
    toDateInputValue(pending.startDate)
  );
  const [endsAt, setEndsAt] = useState(
    toDateInputValue(addDays(pending.startDate, DEFAULT_DURATION_DAYS - 1))
  );
  const [pickedChannels, setPickedChannels] = useState<Set<number>>(
    new Set([pending.channelId])
  );
  const [approveNow, setApproveNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        clearPendingDrop();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  function toggleChannel(id: number) {
    setPickedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("spot_drop.error_name"));
      return;
    }
    if (pickedChannels.size === 0) {
      setError(t("spot_drop.error_no_channels"));
      return;
    }
    if (new Date(endsAt) < new Date(startsAt)) {
      setError(t("spot_drop.error_end_before_start"));
      return;
    }

    const fd = new FormData();
    fd.set("spotId", String(pending.spotId));
    fd.set("name", name.trim());
    fd.set("startsAt", startsAt);
    fd.set("endsAt", endsAt);
    if (approveNow) fd.set("approveNow", "1");
    for (const id of pickedChannels) fd.append("channelIds", String(id));

    startTransition(async () => {
      try {
        const res = await createCampaignFromSpot(fd);
        toast.success(t("spot_drop.created"));
        clearPendingDrop();
        // Refresh server-rendered timeline so the new bar shows up
        // without a full reload. The store is already cleared so the
        // modal won't re-open.
        router.refresh();
        // Soft-navigate to the new campaign's detail; user can hit back
        // to return to the timeline. Skip if you'd rather stay on the
        // timeline — for now jumping to detail confirms the create.
        if (res?.campaignId) {
          router.push(`/campaigns/${res.campaignId}`);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) clearPendingDrop();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spot-drop-modal-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg shadow-2xl ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <h2
              id="spot-drop-modal-title"
              className="text-base font-semibold tracking-tight"
            >
              {t("spot_drop.title")}
            </h2>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {pending.spotName}
              </span>
              {pending.spotProductName && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <span>{pending.spotProductName}</span>
                </>
              )}
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span aria-hidden>{pending.countryFlag}</span>
              <span>{pending.countryCode}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => clearPendingDrop()}
            aria-label={t("common.close")}
            className="shrink-0 -m-1 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm"
        >
          <Field label={t("spot_drop.field.name")} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.start")} required>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field label={t("common.end")} required>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <span className="text-xs text-zinc-500 mb-1 block">
              {t("spot_drop.field.channels")}
            </span>
            <p className="text-xs text-zinc-500 mb-2">
              {t("spot_drop.field.channels_hint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {channelsInCountry.map((c) => (
                <label
                  key={c.id}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors " +
                    (pickedChannels.has(c.id)
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-400 text-blue-900 dark:text-blue-200"
                      : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900")
                  }
                >
                  <input
                    type="checkbox"
                    checked={pickedChannels.has(c.id)}
                    onChange={() => toggleChannel(c.id)}
                    className="sr-only"
                  />
                  <span>{c.chainName}</span>
                  {c.id === pending.channelId && (
                    <span className="text-[9px] uppercase tracking-wide opacity-70">
                      {t("spot_drop.dropped_here")}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={approveNow}
              onChange={(e) => setApproveNow(e.target.checked)}
              className="rounded"
            />
            <span>{t("spot_drop.approve_now")}</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Padding spacer so footer doesn't bump form fields. */}
          <div className="h-1" />
        </form>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-3 flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => clearPendingDrop()}
            disabled={isPending}
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const form = (e.currentTarget as HTMLButtonElement)
                .closest("[role=dialog]")
                ?.querySelector("form");
              if (form instanceof HTMLFormElement) form.requestSubmit();
            }}
            disabled={isPending}
            className="text-sm px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
          >
            {isPending ? t("common.loading") : t("spot_drop.submit")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500 mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
