// Server-side i18n: read locale from cookie, expose t() for server components
// to call directly (no provider needed there). Client components get the same
// API via the LocaleProvider in lib/i18n/client.tsx.

import "server-only";
import { cookies } from "next/headers";
import {
  messages,
  format,
  pluralKey,
  DEFAULT_LOCALE,
  type Locale,
  type MessageKey,
} from "./messages";

const LOCALE_COOKIE = "videospots-locale";

/** Read the user's chosen locale from the cookie set by the switcher. */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(LOCALE_COOKIE)?.value;
  if (v === "en" || v === "cs") return v;
  return DEFAULT_LOCALE;
}

/**
 * Get a translator function bound to the current request's locale.
 * Use in server components:
 *
 *   const t = await getT();
 *   return <h1>{t("timeline.heading")}</h1>;
 */
export async function getT() {
  const locale = await getLocale();
  return makeT(locale);
}

export function makeT(locale: Locale) {
  const dict = messages[locale];
  function t(key: MessageKey, vars?: Record<string, string | number>): string {
    return format(dict[key] ?? key, vars);
  }
  /** Pick the right plural form ("kampaň" / "kampaně" / "kampaní"). */
  t.plural = (
    n: number,
    keyPrefix: "unit.day" | "unit.campaign" | "unit.channel" | "unit.country" | "unit.product"
  ): string => {
    const form = pluralKey(n);
    const key = `${keyPrefix}_${form}` as MessageKey;
    return dict[key] ?? key;
  };
  t.locale = locale;
  return t;
}

export const LOCALE_COOKIE_NAME = LOCALE_COOKIE;
