"use client";

// Client-side counterpart of lib/i18n/server.ts. The locale is passed down
// from the root layout (which reads the cookie server-side), so the provider
// just relays it; the hook is what client components call.
//
//   const t = useT();
//   <button>{t("common.save")}</button>
//
// For brevity client components can also use `useLocale()` to read just the
// raw locale code (e.g. for date formatting that depends on locale).

import { createContext, useContext, useMemo } from "react";
import {
  messages,
  format,
  pluralKey,
  type Locale,
  type MessageKey,
} from "./messages";

const LocaleCtx = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Locale {
  const v = useContext(LocaleCtx);
  if (!v) throw new Error("useLocale must be used inside <LocaleProvider>");
  return v;
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => makeClientT(locale), [locale]);
}

function makeClientT(locale: Locale) {
  const dict = messages[locale];
  function t(key: MessageKey, vars?: Record<string, string | number>): string {
    return format(dict[key] ?? key, vars);
  }
  t.plural = (
    n: number,
    keyPrefix:
      | "unit.day"
      | "unit.campaign"
      | "unit.channel"
      | "unit.country"
      | "unit.product"
  ): string => {
    const form = pluralKey(n);
    const key = `${keyPrefix}_${form}` as MessageKey;
    return dict[key] ?? key;
  };
  t.locale = locale;
  return t;
}
