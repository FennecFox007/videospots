// Resolve a country's display name in the given locale. The DB stores each
// country's Czech name (and ISO code), so when the UI is in Czech we just
// return that. For English we use the platform's Intl.DisplayNames API,
// which knows ISO 3166 codes and produces locale-correct names without
// extra DB columns or per-country dictionaries.
//
// Falls back to the DB-provided name if the API throws (very old runtimes
// or unknown codes).

import type { Locale } from "./messages";

const cache: Record<string, Intl.DisplayNames> = {};

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  if (cache[locale]) return cache[locale];
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    cache[locale] = dn;
    return dn;
  } catch {
    return null;
  }
}

/**
 * @param code  ISO 3166-1 alpha-2 country code ("CZ", "SK", ...)
 * @param fallback  The Czech name from the DB (used as-is for cs locale).
 * @param locale  Current UI locale.
 */
export function localizedCountryName(
  code: string,
  fallback: string,
  locale: Locale
): string {
  if (locale === "cs") return fallback;
  const tag = locale === "en" ? "en-US" : locale;
  const dn = getDisplayNames(tag);
  if (!dn) return fallback;
  try {
    return dn.of(code) ?? fallback;
  } catch {
    return fallback;
  }
}
