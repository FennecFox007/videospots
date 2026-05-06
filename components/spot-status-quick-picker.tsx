"use client";

// Inline status picker for /spots list rows. Replaces the binary
// <SpotApprovalQuickButtons>; the Pill itself is now the trigger — click
// opens a small dropdown with all 5 manual states. Lets editors tick a
// row through "Bez zadání → Zadán → Ve výrobě → Čeká na schválení" (and
// Sony picks "Schválen" via the prompt) without clicking into the detail.
//
// Layout philosophy: keep visual weight low. Pill stays the same size as
// the read-only display variant; only the chevron + hover ring telegraph
// "this is interactive". Dropdown is a tight 5-item menu, no fluff.
//
// Archived spots get the read-only Pill (no dropdown).

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import {
  approveSpot,
  setSpotProductionStatus,
} from "@/app/spots/actions";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { Pill } from "@/components/ui/pill";
import {
  PRODUCTION_STATUSES,
  spotStatusLabelKey,
  spotStatusTone,
  type ProductionStatus,
} from "@/lib/spot-status";

type Props = {
  spotId: number;
  productionStatus: ProductionStatus;
  archived: boolean;
};

export function SpotStatusQuickPicker({
  spotId,
  productionStatus,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, toast } = useDialog();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape — same pattern as ActivityFeed.
  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Read-only Pill for archived rows.
  if (archived) {
    return (
      <Pill size="sm" tone={spotStatusTone(productionStatus)}>
        {t(spotStatusLabelKey(productionStatus))}
      </Pill>
    );
  }

  async function transitionTo(target: ProductionStatus) {
    if (target === productionStatus) {
      setOpen(false);
      return;
    }
    setOpen(false);
    if (target === "schvalen") {
      // Approval flow goes through the prompt so we capture an optional
      // comment + record the approver — same as the detail-page stepper.
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
      return;
    }
    // Plain manual transition. setSpotProductionStatus refuses target =
    // "schvalen" (handled above); the rest are direct.
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

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1 group disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Pill size="sm" tone={spotStatusTone(productionStatus)}>
          <span className="inline-flex items-center gap-1">
            {t(spotStatusLabelKey(productionStatus))}
            <ChevronDown
              className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity"
              strokeWidth={2.5}
            />
          </span>
        </Pill>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-30 w-52 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
        >
          {PRODUCTION_STATUSES.map((status) => {
            const isCurrent = status === productionStatus;
            const isApproveStep = status === "schvalen";
            return (
              <button
                key={status}
                type="button"
                role="menuitem"
                onClick={() => transitionTo(status)}
                disabled={isCurrent || pending}
                title={
                  isApproveStep && !isCurrent
                    ? t("spots.status.tooltip.approve_via_prompt")
                    : undefined
                }
                className={
                  "w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors " +
                  (isCurrent
                    ? "bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 cursor-default"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800")
                }
              >
                <span className="w-3.5">
                  {isCurrent && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                </span>
                <span className="flex-1">{t(spotStatusLabelKey(status))}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
