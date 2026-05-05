// Derived approval state for spots. The DB stores one timestamp
// (clientApprovedAt) — set or null = approved or pending. There's no
// third "rejected" state; partner's workflow is "spots must be approved
// before deployment", so the binary works.
//
// This file consolidates the derivation so the list page, detail page,
// drawer card, campaign-form picker and audit log humanizer all read
// the same source of truth.

import type { PillTone } from "@/components/ui/pill";

export type SpotApprovalState = "approved" | "pending";

/** Compute the derived state from the approval timestamp. */
export function spotApprovalState(spot: {
  clientApprovedAt: Date | null;
}): SpotApprovalState {
  return spot.clientApprovedAt !== null ? "approved" : "pending";
}

/** Pill tone matching the visual signal in the UI: approved = emerald,
 *  pending = amber. */
export function spotApprovalTone(state: SpotApprovalState): PillTone {
  return state === "approved" ? "emerald" : "amber";
}

/** i18n key for the localized status label. */
export function spotApprovalLabelKey(
  state: SpotApprovalState
): "spots.approval.status.approved" | "spots.approval.status.pending" {
  return state === "approved"
    ? "spots.approval.status.approved"
    : "spots.approval.status.pending";
}
