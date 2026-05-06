"use client";

// Detail-page status controls — replaces the binary <SpotApprovalActions>
// with the full 5-state manual workflow + approve/unapprove flow.
//
// Layout: a horizontal stepper of all 5 manual states. Current state is
// highlighted; clicking any non-current state triggers the transition.
// The terminal "Schválen" step is special — clicking it opens the approve
// prompt (so we capture the approver + optional comment), not a plain
// status set. When already approved, the Schválen step shows the approver
// metadata and a subtle "Zrušit schválení" link.
//
// Manual state setter calls setSpotProductionStatus; approve flow calls
// approveSpot. Both refresh the page on success so the visual stepper
// reflects the new server state.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import {
  approveSpot,
  setSpotProductionStatus,
  unapproveSpot,
} from "@/app/spots/actions";
import {
  PRODUCTION_STATUSES,
  type ProductionStatus,
} from "@/lib/spot-status";

type Props = {
  spotId: number;
  productionStatus: ProductionStatus;
  archived: boolean;
};

export function SpotStatusControls({
  spotId,
  productionStatus,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, confirm, toast } = useDialog();
  const [isPending, startTransition] = useTransition();

  // Archived spots are read-only — render nothing.
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

  function handleTransition(target: ProductionStatus) {
    if (target === productionStatus) return; // no-op
    if (target === "schvalen") {
      // Routed through the approve prompt to capture approver + comment.
      void handleApprove();
      return;
    }
    startTransition(async () => {
      try {
        await setSpotProductionStatus(spotId, target);
        toast.success(t("spots.status.toast.changed"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    });
  }

  // Index of the current status in the canonical sequence — "completed"
  // states sit before this index, "future" states after. The stepper uses
  // this to apply a darker border to completed steps and dimmer to future.
  const currentIdx = PRODUCTION_STATUSES.indexOf(productionStatus);

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-1.5 overflow-x-auto -mx-1 px-1">
        {PRODUCTION_STATUSES.map((status, i) => {
          const isCurrent = status === productionStatus;
          const isCompleted = i < currentIdx;
          const isApproveStep = status === "schvalen";
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleTransition(status)}
              disabled={isPending || isCurrent}
              title={
                isApproveStep && !isCurrent
                  ? t("spots.status.tooltip.approve_via_prompt")
                  : undefined
              }
              className={
                "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border " +
                (isCurrent
                  ? // Current state — solid emerald (terminal Schválen) or blue (mid-flow)
                    isApproveStep
                    ? "bg-emerald-600 text-white border-emerald-600 cursor-default"
                    : "bg-blue-600 text-white border-blue-600 cursor-default"
                  : isCompleted
                    ? "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700") +
                " disabled:cursor-not-allowed"
              }
            >
              <span className="inline-flex items-center gap-1">
                {isCompleted && <Check className="w-3 h-3" strokeWidth={2.5} />}
                {t(`spot_status.${status}`)}
              </span>
            </button>
          );
        })}
      </div>

      {productionStatus === "schvalen" && (
        <button
          type="button"
          onClick={handleUnapprove}
          disabled={isPending}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline disabled:opacity-50"
        >
          {t("spots.approval.clear_button")}
        </button>
      )}
    </div>
  );
}
