"use client";

// Generic floating context menu used for right-click on the timeline.
// Closes on click outside / Escape; auto-shifts to stay within the viewport.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

export type ContextMenuItem =
  | { kind: "separator" }
  | {
      kind: "link";
      label: string;
      href: string;
      destructive?: boolean;
    }
  | {
      kind: "action";
      label: string;
      onClick: () => void | Promise<void>;
      destructive?: boolean;
    };

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Reset target position whenever the open trigger changes.
  useEffect(() => setPos({ x, y }), [x, y]);

  // Outside click / Escape → close.
  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  // After mount, nudge into view if it would overflow.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (rect.right > window.innerWidth) {
      nx = Math.max(8, window.innerWidth - rect.width - 8);
    }
    if (rect.bottom > window.innerHeight) {
      ny = Math.max(8, window.innerHeight - rect.height - 8);
    }
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny });
  }, [x, y]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 100 }}
      className="rounded-md bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-lg py-1 min-w-56 select-none"
    >
      {items.map((item, i) => {
        if (item.kind === "separator") {
          return (
            <div
              key={i}
              className="my-1 border-t border-zinc-100 dark:border-zinc-800"
            />
          );
        }
        const className =
          "block w-full text-left px-3 py-1.5 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 " +
          (item.destructive
            ? "text-red-600 hover:text-red-700"
            : "text-zinc-700 dark:text-zinc-200");
        if (item.kind === "link") {
          return (
            <Link
              key={i}
              href={item.href}
              onClick={onClose}
              className={className}
            >
              {item.label}
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={async () => {
              try {
                await item.onClick();
              } finally {
                onClose();
              }
            }}
            className={className}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
