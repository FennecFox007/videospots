import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db, auditLog, users, campaigns } from "@/lib/db/client";
import { ActivityFeed } from "./activity-feed";
import { DarkModeToggle } from "./dark-mode-toggle";

export async function Nav() {
  const session = await auth();

  // Last 10 audit entries for the activity dropdown. Cheap to fetch on every
  // request; we render the layout per-request anyway.
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
        .leftJoin(campaigns, eq(auditLog.entityId, campaigns.id))
        .orderBy(desc(auditLog.createdAt))
        .limit(10)
    : [];

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            videospots
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <NavLink href="/">Timeline</NavLink>
            <NavLink href="/campaigns">Seznam</NavLink>
            <NavLink href="/campaigns/new">Nová</NavLink>
            <NavLink href="/admin/templates">Šablony</NavLink>
            <NavLink href="/admin">Administrace</NavLink>
          </div>
        </div>

        {session?.user && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className="hidden sm:inline-flex items-center gap-1 text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
              title="Stiskni Ctrl+K (Cmd+K na macu) pro vyhledávání"
            >
              🔍 <kbd className="font-mono">⌘K</kbd>
            </span>
            <ActivityFeed entries={recentActivity} />
            <DarkModeToggle />
            <span className="text-zinc-500 px-2">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button
                type="submit"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Odhlásit
              </button>
            </form>
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
    >
      {children}
    </Link>
  );
}
