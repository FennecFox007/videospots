"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/server";
import { LOCALES, type Locale } from "@/lib/i18n/messages";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the user's chosen UI locale in a cookie. Called from the
 * <LocaleSwitcher> in nav. Triggers revalidation of the layout so server
 * components re-render with the new strings.
 */
export async function setLocale(next: string) {
  if (!LOCALES.includes(next as Locale)) {
    throw new Error("Unknown locale");
  }
  const c = await cookies();
  c.set(LOCALE_COOKIE_NAME, next, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false, // client doesn't read this directly, but no secret either
  });
  revalidatePath("/", "layout");
}
