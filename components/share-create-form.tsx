"use client";

// Shared inline form used by <ShareButton> and <TimelineShareButton>: pick
// an expiry preset, optionally add a label, hit Generate. Sits between the
// "Sdílet" trigger and the "here's your URL" output state in both buttons.
//
// Why the same component twice: the create call differs (campaign vs
// timeline payload), but the form input is identical and we want both
// surfaces to expose the same affordances. Caller passes in `onCreate`
// returning the absolute URL; this component owns the state machine for
// chip selection / label input / pending state.

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";

const EXPIRY_PRESETS = [7, 30, 90] as const;
const DEFAULT_PRESET = 30;

export function ShareCreateForm({
  onCreate,
  onCancel,
}: {
  /** Server action wrapper. Receives the chosen expiry + label, returns URL. */
  onCreate: (opts: {
    expiresInDays: number;
    label: string | null;
  }) => Promise<string>;
  /** Caller can hide the form if user dismisses. */
  onCancel: () => void;
}) {
  const [expiry, setExpiry] = useState<number>(DEFAULT_PRESET);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useT();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await onCreate({
          expiresInDays: expiry,
          label: label.trim() || null,
        });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3 flex flex-col gap-2.5 min-w-72">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
          {t("share_form.expiry_label")}
        </div>
        <div className="flex flex-wrap gap-1">
          {EXPIRY_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setExpiry(days)}
              className={
                "text-xs px-2.5 py-1 rounded-md border transition-colors " +
                (expiry === days
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900")
              }
            >
              {t("share_form.expiry_n_days", { n: days })}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
          {t("share_form.label_label")}{" "}
          <span className="text-zinc-400 normal-case tracking-normal">
            ({t("share_form.label_optional")})
          </span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder={t("share_form.label_placeholder")}
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-2.5 py-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="text-xs px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
        >
          {isPending
            ? t("share_button.generating")
            : t("share_form.create")}
        </button>
      </div>
    </div>
  );
}
