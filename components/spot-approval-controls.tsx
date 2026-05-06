"use client";

// Detail-page approval controls — Sony's separate signal, independent
// of the agency's status column.
//
//   - approved (clientApprovedAt set):
//       small "Zrušit schválení" link
//   - not approved:
//       primary "Schválit" button (with prompt for an optional note)
//
// Independent from <SpotStatusControls> (which manages the agency's
// 5-step Status workflow). Setting Status = "Schváleno" doesn't approve;
// approving doesn't change Status. See lib/spot-status.ts.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { approveSpot, unapproveSpot } from "@/app/spots/actions";

type Props = {
  spotId: number;
  /** Sony's actual approval click — null = not approved, set = approved. */
  isApproved: boolean;
  archived: boolean;
};

export function SpotApprovalControls({
  spotId,
  isApproved,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, confirm, toast } = useDialog();
  const [isPending, startTransition] = useTransition();

  if (archived) return null;

  async function handleApprove() {
    const note = await prompt({
      title: t("spots.approval.approve_prompt.title"),
      message: t("spots.approval.approve_prompt.message"),
      placeholder: t("spots.approval.approve_prompt.placeholder"),
      validate: () => null,
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

  if (isApproved) {
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
