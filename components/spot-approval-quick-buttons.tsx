"use client";

// Inline approve / unapprove button rendered next to the status Pill on
// each row in /spots. The detail-page <SpotApprovalActions /> is the
// full picture; this is the hot path for "I just got the email from the
// client, mark it approved without leaving the list".
//
// Two states (no rejection — see lib/spot-approval.ts):
//   - pending:   primary "✓ Schválit" button
//   - approved:  small "Zrušit schválení" link (less urgent state-flip)

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { approveSpot, unapproveSpot } from "@/app/spots/actions";

type Props = {
  spotId: number;
  /** Drives which inline action to show. */
  approved: boolean;
};

export function SpotApprovalQuickButtons({ spotId, approved }: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, confirm, toast } = useDialog();
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

  if (approved) {
    return (
      <button
        type="button"
        onClick={handleUnapprove}
        disabled={isPending}
        className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline disabled:opacity-50"
        title={t("spots.approval.clear_button")}
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
      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
      title={t("spots.approval.approve_button")}
    >
      ✓ {t("spots.approval.approve_button")}
    </button>
  );
}
