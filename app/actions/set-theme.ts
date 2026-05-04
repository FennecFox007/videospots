"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE_NAME, type Theme } from "@/lib/theme/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the user's chosen theme in a cookie. The layout reads this on the
 * next render and adds (or removes) the `dark` class on <html>. Triggers a
 * layout revalidation so the change shows up without a full page reload.
 */
export async function setTheme(next: Theme) {
  if (next !== "light" && next !== "dark") {
    throw new Error("Unknown theme");
  }
  const c = await cookies();
  c.set(THEME_COOKIE_NAME, next, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}
