"use client";

// Small inline form that saves the current campaign as a reusable template.
// Toggles between a single button and a name-input + Save form.

import { useState, useTransition } from "react";
import { saveCampaignAsTemplate } from "@/app/admin/templates/actions";
import { useT } from "@/lib/i18n/client";

export function SaveAsTemplateButton({
  campaignId,
  defaultName,
}: {
  campaignId: number;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useT();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    startTransition(async () => {
      try {
        await saveCampaignAsTemplate(campaignId, fd);
        setDone(true);
        setTimeout(() => {
          setDone(false);
          setOpen(false);
        }, 1500);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        {t("save_template.label")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder={t("save_template.placeholder")}
        className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-sm w-48"
      />
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
      >
        {done
          ? "✓ " + t("save_template.success")
          : isPending
            ? t("share_button.generating")
            : t("save_template.confirm")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-2"
      >
        {t("common.cancel")}
      </button>
      {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
    </form>
  );
}
