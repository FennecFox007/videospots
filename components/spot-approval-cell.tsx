"use client";

// Inline approval cell for /spots list rows. Sony's separate signal —
// totally independent of the agency's status column.
//
// Two visual modes:
//   - approved (clientApprovedAt set):
//       [Schváleno pill] [✕ button to revoke]
//   - not approved:
//       [Schválit] action chip
//
// Approve goes through a prompt to capture an optional note + approver
// (writes clientApprovedAt + clientApprovedComment + approvedById via
// approveSpot). Revoke clears all three via unapproveSpot.
//
// Archived rows render only the read-only Pill.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { approveSpot, unapproveSpot } from "@/app/spots/actions";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { Pill } from "@/components/ui/pill";

type Props = {
  spotId: number;
  /** Sony's actual approval click — null = not approved, set = approved on date X. */
  clientApprovedAt: Date | null;
  archived: boolean;
};

export function SpotApprovalCell({
  spotId,
  clientApprovedAt,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, toast } = useDialog();
  const [pending, startTransition] = useTransition();

  const isApproved = clientApprovedAt !== null;

  if (archived) {
    return isApproved ? (
      <Pill size="sm" tone="emerald">
        {t("spots.approval.status.approved")}
      </Pill>
    ) : (
      <span className="text-xs text-zinc-400">—</span>
    );
  }

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

  function handleRevoke() {
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
      <span className="inline-flex items-center gap-1">
        <Pill size="sm" tone="emerald">
          {t("spots.approval.status.approved")}
        </Pill>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={pending}
          aria-label={t("spots.approval.clear_button")}
          title={t("spots.approval.clear_button")}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleApprove}
      disabled={pending}
      className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 transition-colors"
    >
      ✓ {t("spots.approval.approve_button")}
    </button>
  );
}
