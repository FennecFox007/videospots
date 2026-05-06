"use client";

// Inline status picker for /spots list rows. Pill-as-trigger pattern —
// click opens a portal-rendered dropdown with all 5 manual status states
// (Bez zadání → Zadán → Ve výrobě → Čeká na schválení → Schváleno).
// Sony's actual approval click in /admin is rendered separately by
// <SpotApprovalCell> as an independent signal — see lib/spot-status.ts
// for the conceptual split.
//
// Portal rendering: the menu is mounted to document.body via createPortal
// so it escapes the table's overflow-hidden. Position is computed from
// the trigger's getBoundingClientRect with position: fixed; flips upward
// when there's not enough room below.
//
// Archived rows render a read-only Pill (no dropdown).

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
import { setSpotProductionStatus } from "@/app/spots/actions";
import { useDialog } from "@/components/dialog/dialog-provider";
import { useT } from "@/lib/i18n/client";
import { Pill } from "@/components/ui/pill";
import {
  PRODUCTION_STATUSES,
  productionStatusLabelKey,
  productionStatusTone,
  type ProductionStatus,
} from "@/lib/spot-status";

const MENU_WIDTH_PX = 208;
const MENU_GAP_PX = 4;
const MENU_HEIGHT_PX = 175; // 5 items × ~32px + 8px y-padding

type MenuPosition = {
  top: number;
  left: number;
  flipUp: boolean;
};

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
  const { toast } = useDialog();
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
      <Pill size="sm" tone={productionStatusTone(productionStatus)}>
        {t(productionStatusLabelKey(productionStatus))}
      </Pill>
    );
  }

  function transitionTo(target: ProductionStatus) {
    if (target === productionStatus) {
      setOpen(false);
      return;
    }
    setOpen(false);
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
            className="fixed z-[100] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH_PX,
            }}
          >
            {PRODUCTION_STATUSES.map((status) => {
              const isCurrent = status === productionStatus;
              return (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  onClick={() => transitionTo(status)}
                  disabled={isCurrent || pending}
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
                    {t(productionStatusLabelKey(status))}
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
        <Pill size="sm" tone={productionStatusTone(productionStatus)}>
          <span className="inline-flex items-center gap-1">
            {t(productionStatusLabelKey(productionStatus))}
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
