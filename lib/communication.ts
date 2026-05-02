// Communication type = the *intent* of the campaign relative to a product
// release ("Pre-order teaser", "Launch week", "Out now promo", DLC drop, …).
// Stored on the campaign as `communicationType`; drives badges and filters.

export const COMMUNICATION_TYPES = [
  {
    value: "preorder",
    label: "Pre-order",
    description: "Předobjednávky před vydáním",
    classes:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-800",
  },
  {
    value: "launch",
    label: "Launch",
    description: "Spot k vydání produktu",
    classes:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-800",
  },
  {
    value: "outnow",
    label: "Out Now",
    description: "Po vydání — připomínka, že je to v prodeji",
    classes:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-800",
  },
  {
    value: "dlc",
    label: "DLC",
    description: "Datadisk / rozšíření",
    classes:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-800",
  },
  {
    value: "update",
    label: "Update",
    description: "Větší update / sezóna",
    classes:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 ring-1 ring-cyan-300 dark:ring-cyan-800",
  },
  {
    value: "promo",
    label: "Promo",
    description: "Marketingová akce mimo launch",
    classes:
      "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 ring-1 ring-pink-300 dark:ring-pink-800",
  },
  {
    value: "sale",
    label: "Sleva",
    description: "Cenová akce",
    classes:
      "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-800",
  },
  {
    value: "bundle",
    label: "Bundle",
    description: "Konzole + hra balíček",
    classes:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-800",
  },
  {
    value: "brand",
    label: "Brand",
    description: "Brand awareness, ne konkrétní produkt",
    classes:
      "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 ring-1 ring-zinc-300 dark:ring-zinc-700",
  },
] as const;

export type CommunicationType =
  (typeof COMMUNICATION_TYPES)[number]["value"];

export function isValidCommunicationType(s: string): s is CommunicationType {
  return COMMUNICATION_TYPES.some((c) => c.value === s);
}

export function communicationTypeLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return COMMUNICATION_TYPES.find((c) => c.value === s)?.label ?? s;
}

export function communicationTypeClasses(
  s: string | null | undefined
): string {
  if (!s) return "";
  return COMMUNICATION_TYPES.find((c) => c.value === s)?.classes ?? "";
}

// ---------------------------------------------------------------------------
// Lifecycle phase — computed from campaign dates × product release date.
// Not stored — derived for warnings and tooltips.
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 86_400_000;

export type LifecyclePhase =
  | "no-release" // product has no releaseDate, can't classify
  | "pre-launch" // entire campaign runs before release
  | "launch-window" // release date falls inside the campaign
  | "post-launch"; // entire campaign runs after release

export function computeLifecyclePhase(
  campaignStart: Date,
  campaignEnd: Date,
  productReleaseDate: Date | null | undefined
): LifecyclePhase {
  if (!productReleaseDate) return "no-release";
  const r = productReleaseDate.getTime();
  const cs = campaignStart.getTime();
  const ce = campaignEnd.getTime() + ONE_DAY_MS; // inclusive end-of-day

  if (ce < r) return "pre-launch";
  if (cs > r) return "post-launch";
  // Release date falls inside campaign window.
  return "launch-window";
}

export function lifecycleLabel(phase: LifecyclePhase): string {
  switch (phase) {
    case "pre-launch":
      return "Pre-launch";
    case "launch-window":
      return "Launch week";
    case "post-launch":
      return "Out now";
    case "no-release":
      return "";
  }
}
