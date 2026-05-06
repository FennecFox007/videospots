// DEPRECATED — kept as a compatibility shim during the spot vocabulary
// refactor. New code should use `lib/spot-status.ts` directly.
//
// The old binary "approved/pending" is now the upper end of the 8-state
// production-status workflow:
//   approved → "schvalen"
//   pending  → anything else, but in practice only "ceka_na_schvaleni"
//              for spots that have a videoUrl
//
// Callers using `spotApprovalState` get a coarse-grained view; if they
// need the fine-grained 8 states they should switch to
// `resolveSpotDisplayStatus`.

import {
  spotStatusTone,
  spotStatusLabelKey,
  type ProductionStatus,
} from "@/lib/spot-status";
import type { PillTone } from "@/components/ui/pill";

export type SpotApprovalState = "approved" | "pending";

/** Compute the legacy binary state from the production status (or from
 *  the old clientApprovedAt timestamp — both shapes accepted for back-
 *  compat during the rename). `productionStatus` typed as a wide string
 *  so unnarrowed Drizzle row shapes (column is `text`) flow through. */
export function spotApprovalState(spot: {
  productionStatus?: ProductionStatus | string | null;
  clientApprovedAt?: Date | null;
}): SpotApprovalState {
  if (spot.productionStatus) {
    return spot.productionStatus === "schvalen" ? "approved" : "pending";
  }
  return spot.clientApprovedAt ? "approved" : "pending";
}

/** Pill tone matching the visual signal in the UI: approved = emerald,
 *  pending = amber. */
export function spotApprovalTone(state: SpotApprovalState): PillTone {
  return state === "approved"
    ? spotStatusTone("schvalen")
    : spotStatusTone("ceka_na_schvaleni");
}

/** i18n key for the localized status label. Kept on the legacy
 *  `spots.approval.status.*` namespace for back-compat — Phase 3 migrates
 *  existing call sites to the canonical `spot_status.*` keys returned by
 *  `spotStatusLabelKey()`. Don't read into this list. */
export function spotApprovalLabelKey(
  state: SpotApprovalState
): "spots.approval.status.approved" | "spots.approval.status.pending" {
  return state === "approved"
    ? "spots.approval.status.approved"
    : "spots.approval.status.pending";
}

// Re-export so callers currently importing the unused symbol don't break
// during the gradual migration in Phase 3.
void spotStatusLabelKey;
