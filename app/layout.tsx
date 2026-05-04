import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Nav } from "@/components/nav";
import { CommandPalette } from "@/components/command-palette";
import { DialogProvider } from "@/components/dialog/dialog-provider";
import { CampaignPeek } from "@/components/campaign-peek";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "videospots",
  description: "Plánování video kampaní pro PlayStation",
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  /**
   * Parallel-route slot for intercepted modals. Pages like
   * `app/@modal/(.)campaigns/new/page.tsx` render here when the user
   * navigates to /campaigns/new from / or /campaigns via client-side
   * routing; on direct URL hits the slot defaults to null (see
   * app/@modal/default.tsx).
   */
  modal: React.ReactNode;
}>) {
  // Hide the nav on the sign-in page (no session, looks weird).
  const path = (await headers()).get("x-current-path") ?? "";
  const hideNav = path.startsWith("/sign-in");
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      // Dark mode is applied by the inline script in <head> before React
      // hydrates (so the page doesn't flash light → dark on first paint).
      // That intentionally diverges <html class> from the server-rendered
      // HTML, so suppress the hydration warning on this one element. React
      // still validates the rest of the tree normally.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
         * Dark-mode init runs as an external script in <head> so the browser
         * fetches+executes it before first paint (no FOUC). External (not
         * inline) avoids React 19's "script tag inside render tree" warning,
         * and next/script with beforeInteractive renders an inline tag
         * which still trips the warning. Source in /public/theme-init.js.
         */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <LocaleProvider locale={locale}>
          <DialogProvider>
            {!hideNav && <Nav />}
            <main className="flex-1">{children}</main>
            {!hideNav && <CommandPalette />}
            {modal}
            {/* Imperative peek panel — listens to lib/peek-store and renders
                a right-side drawer when openCampaignPeek() has been called.
                Used to be an intercepting route; see component header. */}
            {!hideNav && <CampaignPeek />}
          </DialogProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
