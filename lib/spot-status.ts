// Spot status — TWO INDEPENDENT axes that share NO derivation:
//
// **Status** (náš, agency-controlled) — stored in spots.production_status:
//   bez_zadani         "Bez zadání"        Sony nezadalo
//   zadan              "Zadán"             máme brief, nezačali jsme
//   ve_vyrobe          "Ve výrobě"         pracujeme
//   ceka_na_schvaleni  "Čeká na schválení" odeslali jsme klientovi, čekáme
//   schvaleno          "Schváleno"         interně víme, že to klient odsouhlasil
//                                          (přes mail / call / cokoli)
//
// All 5 are MANUAL — agency clicks them. There's no auto-progression
// based on URL or anything else; the agent owns this column.
//
// **Schválení** (Sony's actual click in app) — stored in spots.client
// ApprovedAt timestamp:
//   null  → Sony hasn't clicked Schvaluji
//   set   → Sony clicked Schvaluji on date X (also captures
//            approvedById + clientApprovedComment)
//
// CRITICAL: status and schválení are independent. Status "Schváleno"
// (agentura's internal acknowledgment) is NOT the same as schválení =
// Sony actually clicked. They can disagree: agent marks Status =
// Schváleno based on email approval; Sony hasn't logged in yet. Or:
// Sony clicks Schvaluji while agent still has Status = Ve výrobě (because
// final cut isn't quite done).
//
// Three "deployment time" states ("naplanovan" / "bezi" / "skoncil")
// are derived per-deployment from campaign dates relative to today —
// shown on the timeline bar, not as a status. They ride on top of the
// Sony-approval signal (the bar is hatched until Sony actually approves).

import type { PillTone } from "@/components/ui/pill";

// ---------------------------------------------------------------------------
// Status axis (manual, stored in spots.production_status)
// ---------------------------------------------------------------------------

export const PRODUCTION_STATUSES = [
  "bez_zadani",
  "zadan",
  "ve_vyrobe",
  "ceka_na_schvaleni",
  "schvaleno",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export function isProductionStatus(s: unknown): s is ProductionStatus {
  return (
    typeof s === "string" &&
    (PRODUCTION_STATUSES as readonly string[]).includes(s)
  );
}

// ---------------------------------------------------------------------------
// Derived deployment-time state — computed from (campaign dates × today)
// ---------------------------------------------------------------------------

export type DeploymentTimeState = "naplanovan" | "bezi" | "skoncil";

/** Compute per-deployment time state. Only meaningful when the spot
 *  has been APPROVED BY SONY (clientApprovedAt set) — otherwise we
 *  don't talk about "running" or "ended", the bar shows hatched
 *  approval-pending instead. */
export function resolveDeploymentTimeState(
  approvedAt: Date | null,
  dates: { startsAt: Date | null; endsAt: Date | null } | null,
  now: Date = new Date()
): DeploymentTimeState | null {
  if (!approvedAt) return null;
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
 * Status auto-transition on videoUrl change. Conservative — we only
 * push the agent FORWARD on the first URL set (creative is in flight),
 * never auto-progress through ceka_na_schvaleni or schvaleno (those are
 * explicit agent decisions reflecting outside-app communication).
 *
 *   - URL set first time, status was bez_zadani/zadan
 *     → ve_vyrobe (creative work is now in flight)
 *   - any other URL change       → no auto-transition (manual state owned by editor)
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
 * Sony approval reset rule — independent of status. If videoUrl is
 * REPLACED (not just set for the first time) AND Sony had approved,
 * clear the clientApprovedAt timestamps (different creative, prior
 * sign-off no longer applies). Caller does the actual write.
 *
 * The agency's status column is NOT touched here — that's for the
 * editor to decide.
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

export function deploymentTimeStateTone(s: DeploymentTimeState): PillTone {
  return DEPLOYMENT_TIME_TONE[s];
}

const PRODUCTION_LABEL_KEY = {
  bez_zadani: "spot_status.bez_zadani",
  zadan: "spot_status.zadan",
  ve_vyrobe: "spot_status.ve_vyrobe",
  ceka_na_schvaleni: "spot_status.ceka_na_schvaleni",
  schvaleno: "spot_status.schvaleno",
} as const satisfies Record<ProductionStatus, string>;

const DEPLOYMENT_TIME_LABEL_KEY = {
  naplanovan: "spot_status.naplanovan",
  bezi: "spot_status.bezi",
  skoncil: "spot_status.skoncil",
} as const satisfies Record<DeploymentTimeState, string>;

export type ProductionStatusLabelKey =
  (typeof PRODUCTION_LABEL_KEY)[keyof typeof PRODUCTION_LABEL_KEY];
export type DeploymentTimeLabelKey =
  (typeof DEPLOYMENT_TIME_LABEL_KEY)[keyof typeof DEPLOYMENT_TIME_LABEL_KEY];

export function productionStatusLabelKey(
  s: ProductionStatus
): ProductionStatusLabelKey {
  return PRODUCTION_LABEL_KEY[s];
}

export function deploymentTimeLabelKey(
  s: DeploymentTimeState
): DeploymentTimeLabelKey {
  return DEPLOYMENT_TIME_LABEL_KEY[s];
}
