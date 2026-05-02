// Visual badge for campaign status. Uses the computed run state (upcoming /
// active / done / cancelled). There is no draft/approval step — campaigns
// are either active or explicitly cancelled.

import type { RunState } from "@/lib/utils";

type Props = {
  status: string;
  runState?: RunState;
};

export function StatusBadge({ status, runState }: Props) {
  const palette = paletteFor(status, runState);
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium " +
        palette.classes
      }
    >
      {palette.dot && (
        <span
          aria-hidden
          className={"w-1.5 h-1.5 rounded-full " + palette.dot}
        />
      )}
      {palette.label}
    </span>
  );
}

function paletteFor(
  status: string,
  runState?: RunState
): { label: string; classes: string; dot?: string } {
  if (status === "cancelled" || runState === "cancelled") {
    return {
      label: "Zrušeno",
      classes:
        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 line-through",
    };
  }
  if (runState === "active") {
    return {
      label: "Právě běží",
      classes:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
      dot: "bg-emerald-500 animate-pulse",
    };
  }
  if (runState === "upcoming") {
    return {
      label: "Čeká na start",
      classes:
        "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
      dot: "bg-blue-500",
    };
  }
  if (runState === "done") {
    return {
      label: "Doběhlo",
      classes:
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
      dot: "bg-zinc-500",
    };
  }
  return {
    label: "Aktivní",
    classes:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    dot: "bg-emerald-500",
  };
}
