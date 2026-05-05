// Derived approval state for spots. The DB stores two timestamps
// (clientApprovedAt, rejectedAt) that the approve / reject server
// actions keep mutually exclusive. This file consolidates the "what
// state is the spot in" derivation so the list page, detail page,
// drawer card, campaign-form picker and audit log humanizer all read
// the same source of truth.

import type { PillTone } from "@/components/ui/pill";

export type SpotApprovalState = "approved" | "rejected" | "pending";

/** Compute the derived state from the two approval timestamps. */
export function spotApprovalState(spot: {
  clientApprovedAt: Date | null;
  rejectedAt: Date | null;
}): SpotApprovalState {
  if (spot.clientApprovedAt !== null && spot.rejectedAt === null) {
    return "approved";
  }
  if (spot.rejectedAt !== null && spot.clientApprovedAt === null) {
    return "rejected";
  }
  return "pending";
}

/** Pill tone matching the visual signal in the UI:
 *  approved = emerald, rejected = red, pending = amber. */
export function spotApprovalTone(state: SpotApprovalState): PillTone {
  switch (state) {
    case "approved":
      return "emerald";
    case "rejected":
      return "red";
    case "pending":
      return "amber";
  }
}

/** i18n key for the localized status label. */
export function spotApprovalLabelKey(
  state: SpotApprovalState
): "spots.approval.status.approved" | "spots.approval.status.rejected" | "spots.approval.status.pending" {
  switch (state) {
    case "approved":
      return "spots.approval.status.approved";
    case "rejected":
      return "spots.approval.status.rejected";
    case "pending":
      return "spots.approval.status.pending";
  }
}
