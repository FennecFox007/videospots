// DEPRECATED — kept as a compatibility shim for older call sites that
// expressed Sony's binary approval as a "state". Prefer reading
// spots.client_approved_at directly: null = not approved, set =
// approved. The agency's separate Status column (5 stages) lives in
// lib/spot-status.ts.

import type { PillTone } from "@/components/ui/pill";

export type SpotApprovalState = "approved" | "pending";

export function spotApprovalState(spot: {
  clientApprovedAt?: Date | null;
}): SpotApprovalState {
  return spot.clientApprovedAt ? "approved" : "pending";
}

export function spotApprovalTone(state: SpotApprovalState): PillTone {
  return state === "approved" ? "emerald" : "amber";
}

export function spotApprovalLabelKey(
  state: SpotApprovalState
): "spots.approval.status.approved" | "spots.approval.status.pending" {
  return state === "approved"
    ? "spots.approval.status.approved"
    : "spots.approval.status.pending";
}
