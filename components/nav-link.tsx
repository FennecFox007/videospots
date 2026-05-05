"use client";

// Active-aware nav link. Compares the current pathname against `href`
// (exact match for "/", prefix for everything else so /campaigns/123
// keeps the "Seznam" tab highlighted). Active state: bolder text +
// blue bottom border that visually replaces the nav's own border-b
// in that segment.
//
// Originally this used an absolute-positioned underline span that sat
// just below the link, but the parent nav container has
// `overflow-x-auto` for mobile horizontal scrolling — and CSS forces
// overflow-y to auto whenever overflow-x is set, which then turned the
// poking-out underline into a vertical scrollbar. Switching to plain
// border-b-2 keeps the indicator inside the link's box, no overflow
// trickery, no scrollbar.

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function NavLink({ href, children, className }: Props) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={
        // pt-1.5 pb-1 + border-b-2 = same total height as the old py-1.5
        // so active/inactive sit at the same baseline.
        "px-2 sm:px-3 pt-1.5 pb-1 border-b-2 transition-colors whitespace-nowrap inline-flex " +
        (active
          ? "text-zinc-900 dark:text-zinc-100 font-medium border-blue-600 dark:border-blue-500"
          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border-transparent hover:border-zinc-200 dark:hover:border-zinc-700") +
        " " +
        (className ?? "")
      }
    >
      {children}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Prefix match — /campaigns covers /campaigns, /campaigns/123,
  // /campaigns/new etc. Edge case: /spots active when on /spots/new ✓.
  return pathname === href || pathname.startsWith(href + "/");
}
