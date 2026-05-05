"use client";

// Client-side strip for /spots/[id] that wraps approve / reject / clear
// in interactive prompt+confirm dialogs (we want a comment on approve, a
// REQUIRED reason on reject, and a confirm before clearing). Mirrors the
// pattern campaign-peek uses for clientApprovedAt.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import {
  approveSpot,
  rejectSpot,
  clearSpotApproval,
} from "@/app/spots/actions";
import {
  spotApprovalState,
  type SpotApprovalState,
} from "@/lib/spot-approval";

type Props = {
  spotId: number;
  clientApprovedAt: Date | null;
  rejectedAt: Date | null;
  archived: boolean;
};

export function SpotApprovalActions({
  spotId,
  clientApprovedAt,
  rejectedAt,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, confirm, toast } = useDialog();
  const [isPending, startTransition] = useTransition();

  const state: SpotApprovalState = spotApprovalState({
    clientApprovedAt,
    rejectedAt,
  });

  // Archived spots are read-only — hide the action strip entirely.
  if (archived) return null;

  async function handleApprove() {
    const note = await prompt({
      title: t("spots.approval.approve_prompt.title"),
      message: t("spots.approval.approve_prompt.message"),
      placeholder: t("spots.approval.approve_prompt.placeholder"),
      // Comment is optional — null/empty submit is fine.
      validate: () => null,
      confirmLabel: t("spots.approval.approve_button"),
    });
    if (note === null) return; // user dismissed
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

  async function handleClear() {
    const ok = await confirm({
      title: t("spots.approval.clear_confirm.title"),
      message: t("spots.approval.clear_confirm.message"),
      confirmLabel: t("spots.approval.clear_button"),
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await clearSpotApproval(spotId);
        toast.success(t("spots.approval.toast.cleared"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Always show both Approve and Reject; the active one is implied
       *  by the badge in the section header. Click on the same state
       *  re-prompts (so you can update the note / reason). Click on the
       *  opposite flips the state via the mutex in the server action. */}
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className={
          "text-sm px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 " +
          (state === "approved"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30")
        }
      >
        ✓ {t("spots.approval.approve_button")}
      </button>
      <button
        type="button"
        onClick={handleReject}
        disabled={isPending}
        className={
          "text-sm px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50 " +
          (state === "rejected"
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30")
        }
      >
        ✕ {t("spots.approval.reject_button")}
      </button>
      {state !== "pending" && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline ml-2 disabled:opacity-50"
        >
          {t("spots.approval.clear_button")}
        </button>
      )}
    </div>
  );
}
