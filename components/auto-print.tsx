"use client";

// Mounted on /print/* pages — fires window.print() once after mount so the
// browser opens its native PDF dialog automatically. The user just clicks
// "Save as PDF" / "Tisknout" in the dialog.

import { useEffect } from "react";

export function AutoPrint({ delayMs = 400 }: { delayMs?: number }) {
  useEffect(() => {
    // Small delay so layout, fonts, and any images settle before the print
    // dialog snapshots the page.
    const t = setTimeout(() => {
      window.print();
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return null;
}
