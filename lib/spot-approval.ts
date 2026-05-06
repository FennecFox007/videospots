// DEPRECATED — kept as a thin shim while remaining call sites migrate
// to the two-axis API in `lib/spot-status.ts`. The binary "approved/
// pending" abstraction it expressed maps directly onto the new
// approval axis:
//   approved → "schvaleno"
//   pending  → "ceka_na_schvaleni"
// Production axis (bez_zadani / zadan / ve_vyrobe) is unrelated and
// has no representation here.

import {
  approvalStatusFrom,
  approvalStatusLabelKey,
  approvalStatusTone,
} from "@/lib/spot-status";
import type { PillTone } from "@/components/ui/pill";

export type SpotApprovalState = "approved" | "pending";

export function spotApprovalState(spot: {
  clientApprovedAt?: Date | null;
}): SpotApprovalState {
  return spot.clientApprovedAt ? "approved" : "pending";
}

export function spotApprovalTone(state: SpotApprovalState): PillTone {
  return state === "approved"
    ? approvalStatusTone("schvaleno")
    : approvalStatusTone("ceka_na_schvaleni");
}

export function spotApprovalLabelKey(
  state: SpotApprovalState
): "spots.approval.status.approved" | "spots.approval.status.pending" {
  return state === "approved"
    ? "spots.approval.status.approved"
    : "spots.approval.status.pending";
}

// Re-export so the new keys flow without warning when the shim ends up
// mid-migration.
void approvalStatusFrom;
void approvalStatusLabelKey;
