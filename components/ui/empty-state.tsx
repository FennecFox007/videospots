// Shared empty-state shell. Replaces four ad-hoc visuals across /spots,
// /releases, the timeline ("no channels" / "no campaigns in range"), and
// /campaigns. Surfaces drifted between card-shadow, dashed-border, and
// bare-text variants — same situation reading three different ways.
//
//   <EmptyState
//     title="Žádný spot neodpovídá filtrům."
//     description="Zkus filtr uvolnit nebo Vymazat filtry."
//     cta={<Link href="/spots">Reset</Link>}
//   />
//
// Default visual is a dashed-border block: clearest signal of "this is
// intentionally empty, here's what to do next." The `variant="plain"`
// option drops the border for contexts where the surrounding card already
// provides framing.

import type { ReactNode } from "react";

type Props = {
  /** Optional headline. Bolder than description; meant to name what's missing. */
  title?: string;
  /** Required body text — what's empty and (often) what to do about it. */
  description: ReactNode;
  /** Optional action: a button or link to take the user out of the empty state. */
  cta?: ReactNode;
  /** "dashed" (default) draws a dashed border for clearer signaling.
   *  "plain" drops the border for contexts where the parent already
   *  provides a frame (cards, table cells, etc.). */
  variant?: "dashed" | "plain";
};

export function EmptyState({
  title,
  description,
  cta,
  variant = "dashed",
}: Props) {
  return (
    <div
      className={
        "px-5 py-12 text-center text-sm rounded-lg " +
        (variant === "dashed"
          ? "border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500"
          : "text-zinc-500")
      }
    >
      {title && (
        <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {title}
        </div>
      )}
      <div>{description}</div>
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}
