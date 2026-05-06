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
// **Portal rendering**: the menu is mounted to document.body via
// createPortal so it escapes the table's overflow-hidden (which clips
// rounded-corner table containers and was hiding the lower half of the
// dropdown). Position is computed from the trigger's getBoundingClient
// Rect with position: fixed.
//
// Archived spots get the read-only Pill (no dropdown).

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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

// Width of the popover menu in px — kept in sync with the inline style
// on the rendered element so getBoundingClientRect-based placement can
// keep it on-screen when the trigger is near the right viewport edge.
const MENU_WIDTH_PX = 208;
const MENU_GAP_PX = 4;
// Approximate menu height for upward-vs-downward decision. 5 items at
// ~32px each + 8px y-padding. Doesn't need to be exact — just used to
// pick a flip direction.
const MENU_HEIGHT_PX = 175;

type MenuPosition = {
  top: number;
  left: number;
  flipUp: boolean;
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  // Compute viewport position from trigger rect when opening. Flips
  // upward if there's not enough room below; clamps left to keep on
  // screen near the right edge.
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

  // Close on outside click + Escape — same pattern as ActivityFeed.
  // Outside test must include the menu (which is in a portal, not a DOM
  // descendant of the trigger) AND the trigger itself.
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
      // Cheap dismiss — re-positioning the popover during scroll inside
      // the table or page would feel jittery, and the user pretty much
      // always either picks something or scrolls past it.
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

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            // z-[100] sits above the modal layer (z-[80]) but below
            // dialog/toast (z-[90/95]). Matches the project's
            // dropdown-tier z-index from STAV.md.
            className="fixed z-[100] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH_PX,
            }}
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
      {menu}
    </>
  );
}
