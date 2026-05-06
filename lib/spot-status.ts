// Spot status — TWO INDEPENDENT AXES.
//
// **Production axis** (agentura controls): how far the team got with
// making the creative. Three manual states stored in spots.production
// Status:
//   bez_zadani         "Bez zadání"     Sony nezadalo
//   zadan              "Zadán"          máme brief, zatím se nedělá
//   ve_vyrobe          "Ve výrobě"      pracujeme
//
// **Approval axis** (Sony controls): whether the client signed off.
// Derived from spots.clientApprovedAt (Date | null) — same column we've
// always had:
//   null               "Čeká na schválení"   ceka_na_schvaleni
//   set                "Schváleno"           schvaleno
//
// The two axes are independent. A spot can be {ve_vyrobe, schvaleno}
// (Sony approved a draft, we're polishing the final cut), or
// {bez_zadani, ceka_na_schvaleni} (waiting for brief AND no approval),
// any combo. Display shows both pills side by side; transitions on each
// axis are independent (setSpotProductionStatus vs approveSpot).
//
// Three derived states ("naplanovan" / "bezi" / "skoncil") are still
// computed per-deployment from campaign dates relative to today;
// they ride on top of the approval axis (only "schvaleno" can be
// further classified by date).

import type { PillTone } from "@/components/ui/pill";

// ---------------------------------------------------------------------------
// Production axis (manual, stored in spots.production_status)
// ---------------------------------------------------------------------------

export const PRODUCTION_STATUSES = [
  "bez_zadani",
  "zadan",
  "ve_vyrobe",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export function isProductionStatus(s: unknown): s is ProductionStatus {
  return (
    typeof s === "string" &&
    (PRODUCTION_STATUSES as readonly string[]).includes(s)
  );
}

// ---------------------------------------------------------------------------
// Approval axis (derived from clientApprovedAt)
// ---------------------------------------------------------------------------

export const APPROVAL_STATUSES = [
  "ceka_na_schvaleni",
  "schvaleno",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export function approvalStatusFrom(
  spot: { clientApprovedAt: Date | null }
): ApprovalStatus {
  return spot.clientApprovedAt !== null ? "schvaleno" : "ceka_na_schvaleni";
}

// ---------------------------------------------------------------------------
// Derived "where in time" state — only meaningful when approval = schvaleno
// AND there's a deployment context (campaign × dates relative to today).
// ---------------------------------------------------------------------------

export type DeploymentTimeState = "naplanovan" | "bezi" | "skoncil";

export function resolveDeploymentTimeState(
  approvalStatus: ApprovalStatus,
  dates: { startsAt: Date | null; endsAt: Date | null } | null,
  now: Date = new Date()
): DeploymentTimeState | null {
  if (approvalStatus !== "schvaleno") return null;
  if (!dates) return null;
  const { startsAt, endsAt } = dates;
  if (startsAt && startsAt > now) return "naplanovan";
  if (endsAt && endsAt < now) return "skoncil";
  if (startsAt && startsAt <= now && (!endsAt || now <= endsAt)) return "bezi";
  return null;
}

// ---------------------------------------------------------------------------
// Auto-transitions on updateSpot
// ---------------------------------------------------------------------------

/**
 * When videoUrl changes, decide what to do with the production status.
 *
 *   - URL going from empty → set, status was bez_zadani/zadan
 *     → bump to ve_vyrobe (creative work is now in flight)
 *   - URL changing OR being cleared while status was ve_vyrobe
 *     → no production change (manual state; editor handles it)
 *
 * Returns null when no transition fires.
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
    if (currentStatus === "bez_zadani" || currentStatus === "zadan") {
      return "ve_vyrobe";
    }
  }
  return null;
}

/**
 * Approval reset rule — orthogonal from production. If videoUrl is
 * REPLACED (not just set for the first time) AND the spot was approved,
 * the previous client sign-off no longer applies; caller should clear
 * clientApprovedAt + comment + approver.
 */
export function shouldInvalidateApprovalOnUrlChange(
  prevUrl: string | null,
  nextUrl: string | null,
  wasApproved: boolean
): boolean {
  if (!wasApproved) return false;
  const prev = (prevUrl ?? "").trim();
  const next = (nextUrl ?? "").trim();
  if (!prev || !next) return false;
  return prev !== next;
}

// ---------------------------------------------------------------------------
// UI helpers — Pill tones, i18n keys
// ---------------------------------------------------------------------------

const PRODUCTION_TONE: Record<ProductionStatus, PillTone> = {
  bez_zadani: "zinc",
  zadan: "zinc",
  ve_vyrobe: "blue",
};

const APPROVAL_TONE: Record<ApprovalStatus, PillTone> = {
  ceka_na_schvaleni: "amber",
  schvaleno: "emerald",
};

const DEPLOYMENT_TIME_TONE: Record<DeploymentTimeState, PillTone> = {
  naplanovan: "blue",
  bezi: "emerald",
  skoncil: "zinc",
};

export function productionStatusTone(s: ProductionStatus): PillTone {
  return PRODUCTION_TONE[s];
}

export function approvalStatusTone(s: ApprovalStatus): PillTone {
  return APPROVAL_TONE[s];
}

export function deploymentTimeStateTone(s: DeploymentTimeState): PillTone {
  return DEPLOYMENT_TIME_TONE[s];
}

// Literal-union i18n keys so callers passing through t() get strict
// type-checking against the message dictionary.
const PRODUCTION_LABEL_KEY = {
  bez_zadani: "spot_status.bez_zadani",
  zadan: "spot_status.zadan",
  ve_vyrobe: "spot_status.ve_vyrobe",
} as const satisfies Record<ProductionStatus, string>;

const APPROVAL_LABEL_KEY = {
  ceka_na_schvaleni: "spot_status.ceka_na_schvaleni",
  schvaleno: "spot_status.schvaleno",
} as const satisfies Record<ApprovalStatus, string>;

const DEPLOYMENT_TIME_LABEL_KEY = {
  naplanovan: "spot_status.naplanovan",
  bezi: "spot_status.bezi",
  skoncil: "spot_status.skoncil",
} as const satisfies Record<DeploymentTimeState, string>;

export type ProductionStatusLabelKey =
  (typeof PRODUCTION_LABEL_KEY)[keyof typeof PRODUCTION_LABEL_KEY];
export type ApprovalStatusLabelKey =
  (typeof APPROVAL_LABEL_KEY)[keyof typeof APPROVAL_LABEL_KEY];
export type DeploymentTimeLabelKey =
  (typeof DEPLOYMENT_TIME_LABEL_KEY)[keyof typeof DEPLOYMENT_TIME_LABEL_KEY];

export function productionStatusLabelKey(
  s: ProductionStatus
): ProductionStatusLabelKey {
  return PRODUCTION_LABEL_KEY[s];
}

export function approvalStatusLabelKey(
  s: ApprovalStatus
): ApprovalStatusLabelKey {
  return APPROVAL_LABEL_KEY[s];
}

export function deploymentTimeLabelKey(
  s: DeploymentTimeState
): DeploymentTimeLabelKey {
  return DEPLOYMENT_TIME_LABEL_KEY[s];
}

// ---------------------------------------------------------------------------
// Backfill helpers — used by the one-shot migration that narrows the
// production_status column from the legacy 5-state set to the 3-state set.
// Kept here for documentation; one run lives in scripts/.
// ---------------------------------------------------------------------------

/** Normalise a legacy production_status value (which may have included
 *  'ceka_na_schvaleni' or 'schvalen') to the new 3-state production
 *  axis. Approval information should be preserved separately via
 *  clientApprovedAt — this function only handles the production side. */
export function narrowLegacyProductionStatus(legacy: string): ProductionStatus {
  if (legacy === "bez_zadani" || legacy === "zadan" || legacy === "ve_vyrobe") {
    return legacy;
  }
  // Both 'ceka_na_schvaleni' and 'schvalen' (legacy) collapse to
  // ve_vyrobe — they signaled "creative exists" + an approval state on
  // top. The approval state is captured by clientApprovedAt independently.
  return "ve_vyrobe";
}
