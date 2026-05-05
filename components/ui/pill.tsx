// Shared pill / badge primitive. Replaces six near-duplicate "rounded-full
// + small + colored" snippets that drifted on padding, text size and
// whether to ring or not.
//
//   <Pill size="sm" tone="emerald">3 kampaně</Pill>
//   <Pill size="xs" tone="amber">Čeká na schválení</Pill>
//   <Pill size="md" tone="zinc">Cancelled</Pill>
//
// `<StatusBadge>` and `<CommunicationBadge>` are built on top of this.
// Communication-type colors stay in lib/communication.ts as a string of
// Tailwind classes — those have richer palettes than the `tone` enum can
// model, so callers pass `className` instead of `tone` for that case.
//
// Channel chips in the peek panel use `rounded-md` (not `rounded-full`)
// because they read as labels, not pills — those stay open-coded.

import type { ReactNode } from "react";

export type PillSize = "xs" | "sm" | "md";

/** Predefined color schemes for the common case. Each value is a self-
 *  contained tailwind class string (bg + ring + text + dark counterparts).
 *  When you need something custom (e.g. communication-type palette), pass
 *  `className` instead of `tone`. */
export type PillTone =
  | "emerald"
  | "amber"
  | "blue"
  | "red"
  | "zinc"
  | "indigo";

const SIZE_CLASS: Record<PillSize, string> = {
  // Micro pills used inside the peek panel header / per-country hint rows.
  xs: "px-1.5 py-0.5 text-[10px]",
  // Standard chip — communication badges, deployment counts, tag pills.
  sm: "px-2 py-0.5 text-xs",
  // Slightly roomier — status badges that read as the bar's primary signal.
  md: "px-2.5 py-0.5 text-xs",
};

const TONE_CLASS: Record<PillTone, string> = {
  emerald:
    "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:ring-emerald-900 dark:text-emerald-300",
  amber:
    "bg-amber-50 ring-1 ring-amber-200 text-amber-800 dark:bg-amber-950/30 dark:ring-amber-900 dark:text-amber-300",
  blue:
    "bg-blue-50 ring-1 ring-blue-200 text-blue-800 dark:bg-blue-950/30 dark:ring-blue-900 dark:text-blue-300",
  red:
    "bg-red-50 ring-1 ring-red-200 text-red-800 dark:bg-red-950/30 dark:ring-red-900 dark:text-red-300",
  zinc:
    "bg-zinc-100 ring-1 ring-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-300",
  indigo:
    "bg-indigo-50 ring-1 ring-indigo-200 text-indigo-800 dark:bg-indigo-950/30 dark:ring-indigo-900 dark:text-indigo-300",
};

type Props = {
  size?: PillSize;
  /** Predefined color scheme. Mutually exclusive with `className`. */
  tone?: PillTone;
  /** Custom color string — overrides `tone` if both passed. Use this for
   *  communication-type palettes or any one-off. */
  className?: string;
  children: ReactNode;
};

export function Pill({ size = "sm", tone, className, children }: Props) {
  const colorClass =
    className ?? (tone ? TONE_CLASS[tone] : TONE_CLASS.zinc);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${SIZE_CLASS[size]} ${colorClass}`}
    >
      {children}
    </span>
  );
}
