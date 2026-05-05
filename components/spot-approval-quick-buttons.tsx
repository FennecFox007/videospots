"use client";

// Inline approve / reject buttons rendered next to the status Pill on
// each PENDING row in /spots. The detail-page <SpotApprovalActions /> is
// the full picture (incl. reset on already-resolved spots); this is the
// hot path for "I just got the email from the client, mark it approved
// without leaving the list".
//
// Only renders for `pending` rows — once a spot is approved or rejected,
// further state changes go through the detail page (less common, more
// deliberate).
//
// Mirror the prompt flow of <SpotApprovalActions>:
//   - Approve:  optional note prompt → approveSpot(id, note)
//   - Reject:   REQUIRED reason prompt → rejectSpot(id, reason)
// Both router.refresh() on success so the row re-renders with the new
// pill + the buttons disappear (state moved out of pending).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { approveSpot, rejectSpot } from "@/app/spots/actions";

type Props = {
  spotId: number;
};

export function SpotApprovalQuickButtons({ spotId }: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, toast } = useDialog();
  const [isPending, startTransition] = useTransition();

  async function handleApprove() {
    const note = await prompt({
      title: t("spots.approval.approve_prompt.title"),
      message: t("spots.approval.approve_prompt.message"),
      placeholder: t("spots.approval.approve_prompt.placeholder"),
      validate: () => null, // optional comment
      confirmLabel: t("spots.approval.approve_button"),
    });
    if (note === null) return;
    startTransition(async () => {
      try {
        await approveSpot(spotId, note);
        toast.success(t("spots.approval.toast.approved"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  async function handleReject() {
    const reason = await prompt({
      title: t("spots.approval.reject_prompt.title"),
      message: t("spots.approval.reject_prompt.message"),
      placeholder: t("spots.approval.reject_prompt.placeholder"),
      validate: (v) =>
        v.trim() ? null : t("spots.approval.reject_prompt.required"),
      confirmLabel: t("spots.approval.reject_button"),
      destructive: true,
    });
    if (!reason) return;
    startTransition(async () => {
      try {
        await rejectSpot(spotId, reason);
        toast.success(t("spots.approval.toast.rejected"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
        title={t("spots.approval.approve_button")}
      >
        ✓ {t("spots.approval.approve_button")}
      </button>
      <button
        type="button"
        onClick={handleReject}
        disabled={isPending}
        className="text-[11px] font-medium px-1.5 py-0.5 rounded-md border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
        title={t("spots.approval.reject_button")}
        aria-label={t("spots.approval.reject_button")}
      >
        ✕
      </button>
    </div>
  );
}
