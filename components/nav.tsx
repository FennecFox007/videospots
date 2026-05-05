import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db, auditLog, users, campaigns } from "@/lib/db/client";
import { ActivityFeed } from "./activity-feed";
import { DarkModeToggle } from "./dark-mode-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { getT } from "@/lib/i18n/server";
import type { Theme } from "@/lib/theme/server";

export async function Nav({ theme }: { theme: Theme }) {
  const session = await auth();
  const t = await getT();

  // Last 10 audit entries for the activity dropdown. Cheap to fetch on every
  // request; we render the layout per-request anyway.
  //
  // entityId is polymorphic — same numeric id can refer to a campaign or a
  // spot or a user. The campaigns join must filter by entity='campaign'
  // or a spot/user with a colliding id would attach the wrong campaign
  // name to the audit row.
  const recentActivity = session?.user
    ? await db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          entity: auditLog.entity,
          entityId: auditLog.entityId,
          userName: users.name,
          userEmail: users.email,
          campaignName: campaigns.name,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.userId, users.id))
        .leftJoin(
          campaigns,
          and(
            eq(auditLog.entity, "campaign"),
            eq(auditLog.entityId, campaigns.id)
          )
        )
        .orderBy(desc(auditLog.createdAt))
        .limit(10)
    : [];

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 print:hidden">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 gap-2">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link
            href="/"
            className="font-semibold tracking-tight shrink-0"
          >
            videospots
          </Link>
          <div className="flex items-center gap-0.5 text-sm overflow-x-auto -mx-1 px-1">
            <NavLink href="/">{t("nav.timeline")}</NavLink>
            <NavLink href="/releases">{t("nav.releases")}</NavLink>
            <NavLink href="/campaigns">{t("nav.list")}</NavLink>
            <NavLink href="/campaigns/new">{t("nav.new")}</NavLink>
            <NavLink href="/spots">{t("nav.spots")}</NavLink>
            <NavLink href="/admin/templates" className="hidden md:inline-flex">
              {t("nav.templates")}
            </NavLink>
            <NavLink href="/admin">{t("nav.admin")}</NavLink>
          </div>
        </div>

        {session?.user && (
          <div className="flex items-center gap-1 sm:gap-2 text-sm shrink-0">
            <span
              className="hidden lg:inline-flex items-center gap-1 text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
              title={t("nav.search_shortcut_tooltip")}
            >
              🔍 <kbd className="font-mono">⌘K</kbd>
            </span>
            <ActivityFeed entries={recentActivity} />
            <LocaleSwitcher />
            <DarkModeToggle current={theme} />
            <span className="hidden md:inline text-zinc-500 px-2">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button
                type="submit"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 px-1"
                title={t("nav.signout")}
              >
                <span className="hidden sm:inline">{t("nav.signout")}</span>
                <span className="sm:hidden" aria-hidden>
                  ⏻
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={
        "px-2 sm:px-3 py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap inline-flex " +
        (className ?? "")
      }
    >
      {children}
    </Link>
  );
}
