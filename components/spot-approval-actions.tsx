"use client";

// Detail-page action strip: approve when pending, unapprove when
// approved. Pulls the prompt+confirm flow through the dialog provider
// so we capture the optional approval note.
//
// Two states (no rejection — see lib/spot-approval.ts):
//   - pending:  primary "Schválit" button (with prompt for note)
//   - approved: subtle "Zrušit schválení" link (with confirm)

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { approveSpot, unapproveSpot } from "@/app/spots/actions";
import {
  spotApprovalState,
  type SpotApprovalState,
} from "@/lib/spot-approval";

type Props = {
  spotId: number;
  clientApprovedAt: Date | null;
  archived: boolean;
};

export function SpotApprovalActions({
  spotId,
  clientApprovedAt,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, confirm, toast } = useDialog();
  const [isPending, startTransition] = useTransition();

  const state: SpotApprovalState = spotApprovalState({ clientApprovedAt });

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

  async function handleUnapprove() {
    const ok = await confirm({
      title: t("spots.approval.clear_confirm.title"),
      message: t("spots.approval.clear_confirm.message"),
      confirmLabel: t("spots.approval.clear_button"),
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await unapproveSpot(spotId);
        toast.success(t("spots.approval.toast.cleared"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (state === "pending") {
    return (
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="text-sm px-4 py-2 rounded-md font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
      >
        ✓ {t("spots.approval.approve_button")}
      </button>
    );
  }
  // Approved: small secondary "Zrušit schválení" link.
  return (
    <button
      type="button"
      onClick={handleUnapprove}
      disabled={isPending}
      className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline disabled:opacity-50"
    >
      {t("spots.approval.clear_button")}
    </button>
  );
}
