"use client";

// Inline approval-status picker for /spots list rows. Two states:
// "Čeká na schválení" / "Schváleno". Mirrors the production picker
// pattern (Pill-as-trigger + portal-rendered dropdown) so the two
// columns feel uniform on the row.
//
// Picking "Schváleno" opens the approve prompt (capture optional
// note + approver via approveSpot). Picking "Čeká na schválení"
// rolls back via unapproveSpot. Independent of production axis.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { approveSpot, unapproveSpot } from "@/app/spots/actions";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { Pill } from "@/components/ui/pill";
import {
  APPROVAL_STATUSES,
  approvalStatusLabelKey,
  approvalStatusTone,
  type ApprovalStatus,
} from "@/lib/spot-status";

const MENU_WIDTH_PX = 208;
const MENU_GAP_PX = 4;
const MENU_HEIGHT_PX = 85; // 2 items × ~32px + 8px y-padding

type MenuPosition = {
  top: number;
  left: number;
  flipUp: boolean;
};

type Props = {
  spotId: number;
  approvalStatus: ApprovalStatus;
  archived: boolean;
};

export function SpotApprovalQuickPicker({
  spotId,
  approvalStatus,
  archived,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { prompt, toast } = useDialog();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < MENU_HEIGHT_PX + MENU_GAP_PX;
    const top = flipUp
      ? rect.top - MENU_HEIGHT_PX - MENU_GAP_PX
      : rect.bottom + MENU_GAP_PX;
    let left = rect.left;
    const overflowRight = left + MENU_WIDTH_PX - (window.innerWidth - 8);
    if (overflowRight > 0) left -= overflowRight;
    if (left < 8) left = 8;
    setPos({ top, left, flipUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  if (archived) {
    return (
      <Pill size="sm" tone={approvalStatusTone(approvalStatus)}>
        {t(approvalStatusLabelKey(approvalStatus))}
      </Pill>
    );
  }

  async function transitionTo(target: ApprovalStatus) {
    if (target === approvalStatus) {
      setOpen(false);
      return;
    }
    setOpen(false);
    if (target === "schvaleno") {
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
    // target === "ceka_na_schvaleni" → unapprove
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

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[100] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH_PX,
            }}
          >
            {APPROVAL_STATUSES.map((status) => {
              const isCurrent = status === approvalStatus;
              const isApproveStep = status === "schvaleno";
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
                  <span className="flex-1">
                    {t(approvalStatusLabelKey(status))}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1 group disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Pill size="sm" tone={approvalStatusTone(approvalStatus)}>
          <span className="inline-flex items-center gap-1">
            {t(approvalStatusLabelKey(approvalStatus))}
            <ChevronDown
              className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity"
              strokeWidth={2.5}
            />
          </span>
        </Pill>
      </button>
      {menu}
    </>
  );
}
