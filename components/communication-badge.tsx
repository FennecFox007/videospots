// Visual badges for the campaign's communication intent and its derived
// lifecycle phase (campaign dates × product release date). Both are read-only
// — used on detail / list / share / print views.

import {
  communicationTypeLabel,
  communicationTypeClasses,
  computeLifecyclePhase,
  lifecycleLabel,
  type LifecyclePhase,
} from "@/lib/communication";

export function CommunicationBadge({
  type,
  className = "",
}: {
  type: string | null | undefined;
  className?: string;
}) {
  if (!type) return null;
  const classes = communicationTypeClasses(type);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes} ${className}`}
      title="Typ komunikace"
    >
      {communicationTypeLabel(type)}
    </span>
  );
}

const LIFECYCLE_CLASSES: Record<LifecyclePhase, string> = {
  "no-release": "",
  "pre-launch":
    "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900",
  "launch-window":
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900",
  "post-launch":
    "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-900",
  "way-too-early":
    "bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-700",
  "way-too-late":
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-900",
};

export function LifecycleBadge({
  campaignStart,
  campaignEnd,
  productReleaseDate,
  className = "",
}: {
  campaignStart: Date;
  campaignEnd: Date;
  productReleaseDate: Date | null | undefined;
  className?: string;
}) {
  const phase = computeLifecyclePhase(
    campaignStart,
    campaignEnd,
    productReleaseDate
  );
  if (phase === "no-release") return null;
  const label = lifecycleLabel(phase);
  if (!label) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_CLASSES[phase]} ${className}`}
      title="Fáze vůči vydání produktu"
    >
      {label}
    </span>
  );
}
