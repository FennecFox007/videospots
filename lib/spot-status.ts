// Spot status — single source of truth for the 8-state workflow that
// replaces the binary "approved/pending" model from lib/spot-approval.ts.
//
// Five MANUAL states are stored in spots.productionStatus:
//   bez_zadani         "Bez zadání"
//   zadan              "Zadán"
//   ve_vyrobe          "Ve výrobě"
//   ceka_na_schvaleni  "Čeká na schválení"
//   schvalen           "Schválen"
//
// Three DERIVED states are computed per-deployment from campaign_channel
// dates relative to today. They're never stored:
//   naplanovan         "Naplánován"        schvalen + startsAt > today
//   bezi               "Běží"              schvalen + startsAt ≤ today ≤ endsAt
//   skoncil            "Skončil"           schvalen + endsAt < today
//
// The list-page status (without deployment context) shows the manual
// status. Timeline bars + per-deployment views call resolveSpotDisplay
// Status() with the relevant date range to pick up the derived state.

import type { PillTone } from "@/components/ui/pill";

// ---------------------------------------------------------------------------
// Manual production states (stored in DB)
// ---------------------------------------------------------------------------

export const PRODUCTION_STATUSES = [
  "bez_zadani",
  "zadan",
  "ve_vyrobe",
  "ceka_na_schvaleni",
  "schvalen",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export function isProductionStatus(s: unknown): s is ProductionStatus {
  return (
    typeof s === "string" &&
    (PRODUCTION_STATUSES as readonly string[]).includes(s)
  );
}

// ---------------------------------------------------------------------------
// Display states (manual + derived)
// ---------------------------------------------------------------------------

export type DisplayStatus =
  | ProductionStatus
  | "naplanovan"
  | "bezi"
  | "skoncil";

/** Compute the display status for a spot in a given deployment context.
 *  When `dates` is null (e.g. on /spots list page outside any campaign
 *  context), returns the raw production status — a spot doesn't have its
 *  own dates, only deployments do. */
export function resolveSpotDisplayStatus(
  productionStatus: ProductionStatus,
  dates: { startsAt: Date | null; endsAt: Date | null } | null,
  now: Date = new Date()
): DisplayStatus {
  if (productionStatus !== "schvalen") return productionStatus;
  if (!dates) return "schvalen";
  const { startsAt, endsAt } = dates;
  if (startsAt && startsAt > now) return "naplanovan";
  if (endsAt && endsAt < now) return "skoncil";
  if (startsAt && startsAt <= now && (!endsAt || now <= endsAt)) return "bezi";
  return "schvalen"; // schvalen but no dates yet, or pathological case
}

// ---------------------------------------------------------------------------
// Auto-transitions on updateSpot
// ---------------------------------------------------------------------------

/** Compute what productionStatus should become after a videoUrl edit.
 *  Returns null if no auto-transition fires (caller keeps current state).
 *
 *  Rules:
 *    - videoUrl going from "" / null → set    AND status ∈ {bez_zadani, zadan, ve_vyrobe}
 *      → bump to "ceka_na_schvaleni" (creative is now ready for review)
 *    - videoUrl changing               AND status === "schvalen"
 *      → drop back to "ceka_na_schvaleni" (different creative, prior sign-off
 *        no longer applies — also clears clientApprovedAt; caller does that)
 *    - videoUrl unchanged → no transition
 */
export function autoTransitionForUrlChange(
  prevUrl: string | null,
  nextUrl: string | null,
  currentStatus: ProductionStatus
): ProductionStatus | null {
  const prev = (prevUrl ?? "").trim();
  const next = (nextUrl ?? "").trim();
  if (prev === next) return null;

  if (!prev && next) {
    // Setting URL for the first time.
    if (
      currentStatus === "bez_zadani" ||
      currentStatus === "zadan" ||
      currentStatus === "ve_vyrobe"
    ) {
      return "ceka_na_schvaleni";
    }
  }
  if (prev && next && prev !== next) {
    // Replacing URL (different creative).
    if (currentStatus === "schvalen") {
      return "ceka_na_schvaleni";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Backfill — derive a productionStatus from legacy fields
// ---------------------------------------------------------------------------

/** Used in the one-shot migration to seed `productionStatus` from existing
 *  rows that pre-date the column. After migration this is dead code, kept
 *  for documentation + reference. */
export function backfillProductionStatus(spot: {
  videoUrl: string;
  clientApprovedAt: Date | null;
}): ProductionStatus {
  if (spot.clientApprovedAt) return "schvalen";
  if (spot.videoUrl && spot.videoUrl.trim()) return "ceka_na_schvaleni";
  return "bez_zadani";
}

// ---------------------------------------------------------------------------
// UI helpers — Pill tones, i18n keys
// ---------------------------------------------------------------------------

const TONE_BY_STATUS: Record<DisplayStatus, PillTone> = {
  bez_zadani: "zinc",
  zadan: "zinc",
  ve_vyrobe: "blue",
  ceka_na_schvaleni: "amber",
  schvalen: "emerald",
  naplanovan: "blue",
  bezi: "emerald",
  skoncil: "zinc",
};

export function spotStatusTone(status: DisplayStatus): PillTone {
  return TONE_BY_STATUS[status];
}

// Narrowed to a literal-union return type so callers passing the result
// to t() satisfy the strict i18n key type. Each entry is a `as const`
// so the inferred string isn't widened.
const LABEL_KEY_BY_STATUS = {
  bez_zadani: "spot_status.bez_zadani",
  zadan: "spot_status.zadan",
  ve_vyrobe: "spot_status.ve_vyrobe",
  ceka_na_schvaleni: "spot_status.ceka_na_schvaleni",
  schvalen: "spot_status.schvalen",
  naplanovan: "spot_status.naplanovan",
  bezi: "spot_status.bezi",
  skoncil: "spot_status.skoncil",
} as const satisfies Record<DisplayStatus, string>;

export type SpotStatusLabelKey =
  (typeof LABEL_KEY_BY_STATUS)[keyof typeof LABEL_KEY_BY_STATUS];

export function spotStatusLabelKey(status: DisplayStatus): SpotStatusLabelKey {
  return LABEL_KEY_BY_STATUS[status];
}

// ---------------------------------------------------------------------------
// Allowed manual transitions
// ---------------------------------------------------------------------------
//
// Editor toggles between bez_zadani ↔ zadan ↔ ve_vyrobe ↔ ceka_na_schvaleni.
// "schvalen" is reachable only via approveSpot() (which records an audit
// entry + sets clientApprovedAt); unapproveSpot() drops back to
// ceka_na_schvaleni or bez_zadani depending on whether videoUrl is set.
//
// We don't enforce a strict graph (editors should be able to "snap back"
// to any prior state if reality changes — e.g. spot was Schválen but
// Sony retracted, drop it to Ve výrobě and continue). The only forbidden
// manual transition is *into* "schvalen" — that has to go through approve
// flow so we capture the approver + comment + timestamp.

export const FORBIDDEN_MANUAL_TARGET = "schvalen" as const;

export function canManuallyTransitionTo(target: ProductionStatus): boolean {
  return target !== FORBIDDEN_MANUAL_TARGET;
}
