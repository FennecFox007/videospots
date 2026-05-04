// Edge-safe portion of the Auth.js config — pages + callbacks. Providers and
// any DB code live in `auth.ts` (which is server-only). Middleware (proxy.ts)
// imports only this file because it runs on Edge runtime.
//
// See: https://authjs.dev/guides/edge-compatibility

import type { NextAuthConfig } from "next-auth";

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
        path.startsWith("/api/share/") || // public approval / similar endpoints
        path === "/favicon.ico";
      if (isPublic) return true;
      // /print/* still requires auth — printables are internal handoff aids,
      // not external sharing (use /share/* for that).
      return !!auth?.user;
    },
    // Expose user.id on the session via JWT.sub. Runs on every session read,
    // including in proxy — must be Edge-safe (no DB).
    session({ session, token }) {
      if (session.user && token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
};
