// Server-side auth + role gates. Use these in server actions and server
// components instead of hand-rolling `auth()` checks per call site.
//
//   const userId = await requireUser();          // any authed
//   const userId = await requireEditor();        // editor or admin
//   const userId = await requireAdmin();         // admin only
//
// Errors throw — the route handler / server action will surface them as
// the standard "Unauthorized" / "Forbidden" path (next-auth redirects on
// no-session via the middleware; explicit role-fail throws bubble up to
// the action's caller toast).

import { auth } from "@/auth";
import { roleAtLeast, type Role } from "@/lib/roles";

/** Require a signed-in user. Returns the user id on success. Used to
 *  exist as a private helper in every actions.ts file; centralized here
 *  so role-gates can build on top of it. */
export async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Require at least the given role. Throws "Forbidden" on insufficient
 *  privilege. Returns the user id on success. */
export async function requireRole(min: Role): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const role: Role = session.user.role ?? "viewer";
  if (!roleAtLeast(role, min)) {
    throw new Error("Forbidden");
  }
  return session.user.id;
}

/** Editor or admin. The default for "creates / edits / deletes content
 *  but not user / role mgmt". Most campaign + spot mutations sit here. */
export function requireEditor(): Promise<string> {
  return requireRole("editor");
}

/** Admin only. Gate /admin/* on this. */
export function requireAdmin(): Promise<string> {
  return requireRole("admin");
}

/** Read the current user's role without throwing. Returns "viewer" as
 *  the safe default if there's no session or an old JWT lacks the field. */
export async function getCurrentRole(): Promise<Role | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user.role ?? "viewer";
}
