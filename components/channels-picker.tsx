"use client";

// Channel selection widget used by the campaign create/edit form.
//
// Goals:
// - Make "select all" / "select all of country X" a one-click thing.
// - Keep the form action signature (FormData with `channelIds[]`) unchanged
//   so server actions don't need to care which UI rendered the inputs.
//
// The component holds a Set<number> of selected channel ids and renders
// controlled checkboxes (name="channelIds"). FormData on submit reads the
// actual DOM `checked` state, so React's controlled state shows up correctly.

import { useState } from "react";
import type { CountryGroup } from "./campaign-form-body";
import { useT } from "@/lib/i18n/client";
import { localizedCountryName } from "@/lib/i18n/country";

type Props = {
  groups: CountryGroup[];
  defaultSelected?: number[];
};

export function ChannelsPicker({ groups, defaultSelected }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(defaultSelected ?? [])
  );

  const allIds = groups.flatMap((g) => g.channels.map((c) => c.id));
  const total = allIds.length;
  const selectedCount = selected.size;

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setMany(ids: number[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function invert() {
    setSelected((prev) => {
      const next = new Set<number>();
      for (const id of allIds) if (!prev.has(id)) next.add(id);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {t("timeline.no_channels")}{" "}
        <a className="underline" href="/admin/channels">
          {t("timeline.no_channels_link")}
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Master toggle bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-50 dark:bg-zinc-950 px-3 py-2 border border-zinc-200 dark:border-zinc-800">
        <div className="text-sm">
          {t("picker.selected")}:{" "}
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {selectedCount}
          </span>{" "}
          / {total}
        </div>
        <div className="flex gap-1">
          <ToolBtn onClick={() => setMany(allIds, true)}>
            {t.locale === "en" ? "All" : "Vše"}
          </ToolBtn>
          <ToolBtn onClick={() => setMany(allIds, false)}>
            {t.locale === "en" ? "None" : "Žádné"}
          </ToolBtn>
          <ToolBtn onClick={invert}>
            {t.locale === "en" ? "Invert" : "Inverze"}
          </ToolBtn>
        </div>
      </div>

      {/* Per-country groups */}
      {groups.map((g) => {
        const ids = g.channels.map((c) => c.id);
        const inGroup = ids.filter((id) => selected.has(id)).length;
        const allOn = ids.length > 0 && inGroup === ids.length;
        const someOn = inGroup > 0 && inGroup < ids.length;

        return (
          <div
            key={g.id}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3"
          >
            <button
              type="button"
              onClick={() => setMany(ids, !allOn)}
              className="w-full flex items-center justify-between mb-2 group text-left"
            >
              <div className="font-medium text-sm flex items-center gap-2">
                <TriCheckbox state={allOn ? "all" : someOn ? "some" : "none"} />
                <span className="mr-0.5">{g.flag}</span>
                <span>{localizedCountryName(g.code, g.name, t.locale)}</span>
                <span className="text-xs text-zinc-500 font-normal">
                  ({inGroup}/{ids.length})
                </span>
              </div>
              <span className="text-xs text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                {allOn ? t("picker.deselect_all") : t("picker.select_all")}
              </span>
            </button>

            <div className="flex flex-wrap gap-2">
              {g.channels.map((ch) => {
                const isOn = selected.has(ch.id);
                return (
                  <label
                    key={ch.id}
                    className={
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors " +
                      (isOn
                        ? "bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-950/40 dark:border-blue-400 dark:text-blue-100"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950")
                    }
                  >
                    <input
                      type="checkbox"
                      name="channelIds"
                      value={ch.id}
                      checked={isOn}
                      onChange={() => toggleOne(ch.id)}
                      className="rounded"
                    />
                    {ch.chainName}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      {children}
    </button>
  );
}

/** Tri-state checkbox visual (none / some / all). Decoration only — the form
 * captures state from individual channel checkboxes, not this. */
function TriCheckbox({ state }: { state: "all" | "some" | "none" }) {
  return (
    <span
      aria-hidden
      className={
        "w-4 h-4 rounded border flex items-center justify-center text-white text-[11px] leading-none " +
        (state === "all"
          ? "bg-blue-600 border-blue-600"
          : state === "some"
            ? "bg-blue-300 dark:bg-blue-900 border-blue-400 dark:border-blue-600"
            : "border-zinc-300 dark:border-zinc-700")
      }
    >
      {state === "all" ? "✓" : state === "some" ? "–" : ""}
    </span>
  );
}
