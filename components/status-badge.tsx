// Visual badge for campaign status. Uses the computed run state (upcoming /
// active / done / cancelled). There is no draft/approval step — campaigns
// are either active or explicitly cancelled.
//
// Built on the shared <Pill> primitive so status pills sit visually next
// to other badges (communication type, deployment count) without the
// "different family" feeling that ring-vs-no-ring used to give them.

import { Pill } from "@/components/ui/pill";
import type { RunState } from "@/lib/utils";

type Props = {
  status: string;
  runState?: RunState;
};

export function StatusBadge({ status, runState }: Props) {
  const palette = paletteFor(status, runState);
  return (
    <Pill size="md" className={palette.classes}>
      {palette.dot && (
        <span
          aria-hidden
          className={"w-1.5 h-1.5 rounded-full " + palette.dot}
        />
      )}
      {palette.label}
    </Pill>
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
        "bg-zinc-100 ring-1 ring-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-500 line-through",
    };
  }
  if (runState === "active") {
    return {
      label: "Právě běží",
      classes:
        "bg-emerald-100 ring-1 ring-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:ring-emerald-900 dark:text-emerald-300",
      dot: "bg-emerald-500 animate-pulse",
    };
  }
  if (runState === "upcoming") {
    return {
      label: "Čeká na start",
      classes:
        "bg-blue-100 ring-1 ring-blue-200 text-blue-800 dark:bg-blue-950/60 dark:ring-blue-900 dark:text-blue-300",
      dot: "bg-blue-500",
    };
  }
  if (runState === "done") {
    return {
      label: "Doběhlo",
      classes:
        "bg-zinc-100 ring-1 ring-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:ring-zinc-700 dark:text-zinc-400",
      dot: "bg-zinc-500",
    };
  }
  return {
    label: "Aktivní",
    classes:
      "bg-emerald-100 ring-1 ring-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:ring-emerald-900 dark:text-emerald-300",
    dot: "bg-emerald-500",
  };
}
