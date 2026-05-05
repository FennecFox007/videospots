"use client";

// Shared form used by <ShareButton> and <TimelineShareButton>: pick an
// expiry preset, optionally add a label, hit Create.
//
// Designed to render as a *popover* — caller wraps it in a `relative`
// container and this component absolutely-positions itself below the
// trigger so it doesn't compress the toolbar/flex parent. (Inline-in-flex
// rendering squeezed the form to ~150px on narrow toolbars and stacked
// every chip on its own row.)
//
// Why the same component twice: the create call differs (campaign vs
// timeline payload), but the form input is identical and we want both
// surfaces to expose the same affordances. Caller passes in `onCreate`
// returning the absolute URL; this component owns the state machine for
// chip selection / label input / pending state.

import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";

const EXPIRY_PRESETS = [7, 30, 90] as const;
const DEFAULT_PRESET = 30;

export function ShareCreateForm({
  onCreate,
  onCancel,
  align = "left",
}: {
  /** Server action wrapper. Receives the chosen expiry + label, returns URL. */
  onCreate: (opts: {
    expiresInDays: number;
    label: string | null;
  }) => Promise<string>;
  /** Caller can hide the form if user dismisses. */
  onCancel: () => void;
  /** Anchor edge of the popover relative to the trigger. Toolbar's right-
   *  most actions (TimelineShareButton) want align="right" so the form
   *  doesn't fall off the right edge of the viewport. */
  align?: "left" | "right";
}) {
  const [expiry, setExpiry] = useState<number>(DEFAULT_PRESET);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape, mirroring <ActivityFeed> and the
  // other dropdown surfaces.
  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onCancel();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onCancel]);

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
    <div
      ref={ref}
      className={
        // Popover floats over the page so it doesn't squeeze its parent.
        // w-[22rem] keeps the chips on one row and gives the label input
        // breathing room. shadow-lg lifts it above the toolbar visually.
        "absolute top-full mt-1.5 z-30 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-lg p-3 flex flex-col gap-2.5 " +
        (align === "right" ? "right-0" : "left-0")
      }
      role="dialog"
      aria-label={t("share_form.expiry_label")}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0">
          {t("share_form.expiry_label")}
        </span>
        <div className="flex gap-1">
          {EXPIRY_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setExpiry(days)}
              className={
                "text-xs px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap " +
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
