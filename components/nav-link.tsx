"use client";

// Active-aware nav link. Compares the current pathname against `href`
// (exact match for "/", prefix for everything else so /campaigns/123
// keeps the "Seznam" tab highlighted). Active state styles a bottom
// border + bolder text — quiet enough to not yell, distinct enough
// to read at a glance.

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
        "relative px-2 sm:px-3 py-1.5 rounded-md transition-colors whitespace-nowrap inline-flex " +
        (active
          ? "text-zinc-900 dark:text-zinc-100 font-medium"
          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900") +
        " " +
        (className ?? "")
      }
    >
      {children}
      {active && (
        // Underline accent — sits just below the link, scoped via
        // relative on the parent. Slightly softer than border-b so
        // the layout grid stays calm.
        <span
          aria-hidden
          className="absolute -bottom-[7px] left-2 right-2 sm:left-3 sm:right-3 h-0.5 bg-blue-600 dark:bg-blue-500 rounded-full"
        />
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // Prefix match — /campaigns covers /campaigns, /campaigns/123,
  // /campaigns/new etc. Edge case: /spots active when on /spots/new ✓.
  return pathname === href || pathname.startsWith(href + "/");
}
