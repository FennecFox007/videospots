"use client";

// Inline-renameable campaign title for the detail page. Click the pencil to
// switch to an input; Enter saves, Escape cancels. Server action is called
// optimistically — we show the new name immediately, then the page re-renders.

import { useState, useTransition } from "react";
import { renameCampaign } from "@/app/campaigns/[id]/actions";
import { useT } from "@/lib/i18n/client";

export function EditableCampaignTitle({
  campaignId,
  initialName,
}: {
  campaignId: number;
  initialName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  // Optimistic display — survives until next server render delivers the new prop.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useT();

  const display = optimistic ?? initialName;

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t("editable_title.empty_error"));
      return;
    }
    if (trimmed === display) {
      setEditing(false);
      return;
    }
    setError(null);
    setOptimistic(trimmed);
    setEditing(false);
    startTransition(async () => {
      try {
        await renameCampaign(campaignId, trimmed);
        // Server revalidation will swap initialName → trimmed; clear optimistic.
        setOptimistic(null);
      } catch (e) {
        setError((e as Error).message);
        setOptimistic(null);
      }
    });
  }

  function cancel() {
    setValue(display);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          maxLength={200}
          className="text-2xl font-semibold tracking-tight rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-72"
        />
        <button
          type="button"
          onClick={save}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
        >
          {t("editable_title.save")}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {t("editable_title.cancel")}
        </button>
        {error && (
          <span className="text-xs text-red-600 ml-1">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1
        className="text-2xl font-semibold tracking-tight cursor-text"
        onDoubleClick={() => setEditing(true)}
        title={t("editable_title.tooltip")}
      >
        {display}
        {isPending && (
          <span className="text-xs text-zinc-400 font-normal ml-2">
            {t("editable_title.saving")}
          </span>
        )}
      </h1>
      <button
        type="button"
        onClick={() => {
          setValue(display);
          setEditing(true);
        }}
        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
        title={t("editable_title.rename")}
        aria-label={t("editable_title.rename")}
      >
        ✎
      </button>
    </div>
  );
}
