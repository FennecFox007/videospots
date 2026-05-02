// Route-level auth gate (Next.js 16 "proxy" convention; was previously
// "middleware.ts" — same concept, new file name).
//
// Uses only the Edge-safe slice of Auth.js (no DB adapter). The `authorized`
// callback in auth.config.ts decides whether to allow each request; if it
// returns false on a non-API route, Auth.js redirects to /sign-in.

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const handler = NextAuth(authConfig);
export const proxy = handler.auth;

export const config = {
  matcher: [
    // Skip Next.js internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
