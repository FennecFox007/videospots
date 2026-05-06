"use client";

// Detail-page production-axis stepper. Shows the 3 manual production
// states (Bez zadání → Zadán → Ve výrobě) as a horizontal pill-stepper
// with Check marks for completed states. Click any non-current state →
// setSpotProductionStatus.
//
// Approval axis is rendered separately by <SpotApprovalActions> next to
// this — they live on independent axes (see lib/spot-status.ts).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { setSpotProductionStatus } from "@/app/spots/actions";
import {
  PRODUCTION_STATUSES,
  productionStatusLabelKey,
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
  const { toast } = useDialog();
  const [isPending, startTransition] = useTransition();

  if (archived) return null;

  function handleTransition(target: ProductionStatus) {
    if (target === productionStatus) return;
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

  const currentIdx = PRODUCTION_STATUSES.indexOf(productionStatus);

  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto -mx-1 px-1">
      {PRODUCTION_STATUSES.map((status, i) => {
        const isCurrent = status === productionStatus;
        const isCompleted = i < currentIdx;
        return (
          <button
            key={status}
            type="button"
            onClick={() => handleTransition(status)}
            disabled={isPending || isCurrent}
            className={
              "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border " +
              (isCurrent
                ? "bg-blue-600 text-white border-blue-600 cursor-default"
                : isCompleted
                  ? "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700") +
              " disabled:cursor-not-allowed"
            }
          >
            <span className="inline-flex items-center gap-1">
              {isCompleted && <Check className="w-3 h-3" strokeWidth={2.5} />}
              {t(productionStatusLabelKey(status))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
