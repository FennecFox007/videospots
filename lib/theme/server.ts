// Server-side theme resolution. Mirror of lib/i18n/server.ts: read a cookie,
// hand the value back to layout.tsx, which adds (or doesn't) the `dark` class
// to <html>. No client-side script, no FOUC, no "script tag in render tree"
// warning from React 19.
//
// Trade-off vs the previous localStorage + inline-script setup: we no longer
// auto-respect prefers-color-scheme on first visit. New users default to
// light mode and toggle once. For an internal B2B tool that's acceptable;
// the win on the warnings + correctness side is much bigger.

import "server-only";
import { cookies } from "next/headers";

const THEME_COOKIE = "videospots-theme";

export type Theme = "light" | "dark";

export async function getTheme(): Promise<Theme> {
  const c = await cookies();
  const v = c.get(THEME_COOKIE)?.value;
  return v === "dark" ? "dark" : "light";
}

export const THEME_COOKIE_NAME = THEME_COOKIE;
