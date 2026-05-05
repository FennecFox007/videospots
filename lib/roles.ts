// Role-based access control. Three roles, intentionally simple:
//
//   admin   — everything: full app, /admin/* incl. user + role mgmt
//   editor  — full app: create/edit/delete campaigns + spots, no /admin
//   viewer  — read-only: peek panel, share view, no mutations
//
// "Full app" excludes /admin/* (admin-only) and the share view's authed
// upgrade path (clicking "Schvaluji" requires editor+ since it's a
// mutation on the campaign).
//
// The role lives on `users.role` and is carried into the JWT session at
// signin. The auth.config.ts session callback surfaces it as
// `session.user.role` so server code can check synchronously without a DB
// roundtrip.
//
// Use the requireAdmin / requireEditor / requireViewer helpers from
// lib/auth-helpers.ts in server actions and server components — they
// throw on insufficient permission and return the userId on success.

export const ROLES = ["admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Type guard for runtime values coming from the DB / form / JWT. */
export function isValidRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** "is at least this role" — admin satisfies all, editor satisfies
 *  editor+viewer, viewer satisfies only viewer. */
export function roleAtLeast(actual: Role, required: Role): boolean {
  const order: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };
  return order[actual] >= order[required];
}

/** Localized labels — used in /admin/users UI and audit log humanization.
 *  Shipped as a function rather than a const map so callers pull the
 *  Czech / English variant via t(). */
export const ROLE_LABEL_KEY: Record<Role, string> = {
  admin: "roles.admin",
  editor: "roles.editor",
  viewer: "roles.viewer",
};
