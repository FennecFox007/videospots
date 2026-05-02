import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Nav } from "@/components/nav";
import { CommandPalette } from "@/components/command-palette";

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

  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
         * Apply theme class before hydration to avoid FOUC. Reads localStorage
         * (user override) and falls back to OS prefers-color-scheme.
         */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        {!hideNav && <Nav />}
        <main className="flex-1">{children}</main>
        {!hideNav && <CommandPalette />}
        {modal}
      </body>
    </html>
  );
}
