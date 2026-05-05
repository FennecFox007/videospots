// Edge-safe portion of the Auth.js config — pages + callbacks. Providers and
// any DB code live in `auth.ts` (which is server-only). Middleware (proxy.ts)
// imports only this file because it runs on Edge runtime.
//
// See: https://authjs.dev/guides/edge-compatibility

import type { NextAuthConfig } from "next-auth";
import { isValidRole, type Role } from "@/lib/roles";

// Module augmentation so session.user.role and the User shape carry role
// types throughout the auth pipeline. JWT-side typing is intentionally
// loose (`token.role` accessed via `unknown` then validated with
// isValidRole) — augmenting "next-auth/jwt" requires importing
// "@auth/core/jwt" types which the bundler resolves inconsistently in
// this Next 16 / Auth.js v5-beta combo. Runtime safety is preserved by
// the isValidRole guards in the callbacks below.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: Role;
    };
  }
  interface User {
    role?: Role;
  }
}

export const authConfig: NextAuthConfig = {
  // Empty here; real providers live in auth.ts.
  providers: [],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isPublic =
        path.startsWith("/sign-in") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/share/") || // public read-only client links
        path === "/favicon.ico";
      if (isPublic) return true;
      // /print/* still requires auth — printables are internal handoff aids,
      // not external sharing (use /share/* for that).
      return !!auth?.user;
    },
    // Stamp role onto the JWT at sign-in time. Subsequent reads pull it
    // out of the token; we deliberately don't re-fetch the DB here so
    // this stays Edge-safe and free from per-request lookups. If an
    // admin demotes a user, that user keeps their old role until the
    // JWT expires — same trade-off Auth.js documents for any field
    // surfaced via JWT.
    jwt({ token, user }) {
      if (user && isValidRole(user.role)) {
        // token is loosely typed by Auth.js; we stash role here and
        // pull it out (validated) in the session callback below.
        (token as Record<string, unknown>).role = user.role;
      }
      return token;
    },
    // Expose user.id + user.role on the session. Runs on every session
    // read, including in proxy — must be Edge-safe (no DB).
    session({ session, token }) {
      if (session.user && token?.sub) {
        session.user.id = token.sub;
        // Role on the token is the source of truth post-signin.
        // Default to "viewer" if a token from before this change is
        // still in flight — least-privilege fallback.
        const tokenRole = (token as Record<string, unknown>).role;
        session.user.role = isValidRole(tokenRole) ? tokenRole : "viewer";
      }
      return session;
    },
  },
  trustHost: true,
};
