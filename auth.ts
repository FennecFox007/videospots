// Full Auth.js setup — only imported by server-runtime code (route handlers,
// server components, server actions). Middleware uses auth.config.ts instead.
//
// Auth strategy: Credentials provider (email + bcrypt password) with JWT
// sessions. Users are created/managed by admins through /admin/users; there's
// no self-signup. This is intentional — the team is small and closed.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db/client";
import { authConfig } from "./auth.config";
import { isValidRole } from "@/lib/roles";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // Credentials provider requires JWT (not database) sessions.
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail / username", type: "text" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Surface `role` so the JWT callback in auth.config can fan it
        // out into the token + session. DB column is plain text; validate
        // against the canonical union here so a hand-edited DB value
        // can't smuggle a bogus role into the session. Falls back to
        // "viewer" (least privilege) if validation fails.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: isValidRole(user.role) ? user.role : "viewer",
        };
      },
    }),
  ],
});
