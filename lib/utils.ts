import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combine Tailwind class names safely — later classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date as "YYYY-MM-DD" for <input type="date">.
 *
 * IMPORTANT: must use LOCAL components, not toISOString(). The previous
 * ISO-based version silently shifted dates by a day for any timezone east
 * of UTC: a Czech-local midnight (e.g. 2026-05-05 00:00 CEST) becomes
 * 2026-05-04 22:00 UTC, and slicing the ISO string returned "2026-05-04"
 * — one day earlier than what the user picked. Affected the click-to-
 * create-campaign flow, the drag-and-drop modal pre-fill, and every URL
 * param built from a snapped Date.
 */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive overlap test: do [aStart,aEnd] and [bStart,bEnd] share any time? */
export function dateRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ---------------------------------------------------------------------------
// Date formatting (Czech locale)
// ---------------------------------------------------------------------------
// Centralized so the whole app shows dates the same way. Intl.DateTimeFormat
// is constructed once at module load (allocations are not free).

const csDateFull = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const csDateShort = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
});

const csMonthLong = new Intl.DateTimeFormat("cs-CZ", { month: "long" });
const monthFmtCache: Record<string, Intl.DateTimeFormat> = { "cs-CZ": csMonthLong };

/** "27. 4. 2026" */
export function formatDate(d: Date): string {
  return csDateFull.format(d);
}

/** "27. 4." — for compact column headers */
export function formatDateShort(d: Date): string {
  return csDateShort.format(d);
}

/**
 * Locale-aware month name. Default is Czech for back-compat with callers
 * that don't care; pass `"en-US"` (or any BCP-47 tag) to get the English
 * name. Formatters are cached per locale.
 */
export function formatMonthName(d: Date, locale: string = "cs-CZ"): string {
  if (!monthFmtCache[locale]) {
    monthFmtCache[locale] = new Intl.DateTimeFormat(locale, { month: "long" });
  }
  return monthFmtCache[locale].format(d);
}

/**
 * Inclusive day count between two dates (treated as date-only, midnight-based).
 *
 * Campaigns store `endsAt` at midnight of the LAST day they run, so the user's
 * "May 1 → May 14" campaign actually runs 14 days (May 1, 2, …, 14). Plain
 * `(end - start) / day` would give 13. We return inclusive count.
 */
export function daysBetween(start: Date, end: Date): number {
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diffDays + 1);
}

/**
 * Add N days to a date and return a new Date. Avoids mutating the original.
 */
export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Snap a date back to its Monday (start of week) at 00:00 local time. */
export function snapToMondayStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  out.setDate(out.getDate() - daysBack);
  return out;
}

/** Czech-style noun pluralization. (1 = one, 2-4 = few, else = many.) */
export function pluralCs(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

// ---------------------------------------------------------------------------
// Campaign status
// ---------------------------------------------------------------------------
//
// Campaigns are either active or cancelled — there is no draft/approval step.
// "Active / upcoming / done" are computed from dates, not stored.
//
// The DB column value for active is the string "approved" (kept for backward
// compatibility with existing rows and audit log entries — the user-facing
// label is "Aktivní" so this never leaks).

export const CAMPAIGN_STATUSES = [
  { value: "approved", label: "Aktivní", short: "OK" },
  { value: "cancelled", label: "Zrušeno", short: "ZR" },
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]["value"];

export function isValidStatus(s: string): s is CampaignStatus {
  return CAMPAIGN_STATUSES.some((x) => x.value === s);
}

export function statusLabel(s: string): string {
  return CAMPAIGN_STATUSES.find((x) => x.value === s)?.label ?? s;
}

/**
 * Finer-grained "run state" derived from status + dates. Used for badges /
 * timeline visuals. Not stored.
 */
export type RunState = "upcoming" | "active" | "done" | "cancelled";

export function computedRunState(c: {
  status: string;
  startsAt: Date;
  endsAt: Date;
}): RunState {
  if (c.status === "cancelled") return "cancelled";
  const now = Date.now();
  if (now < c.startsAt.getTime()) return "upcoming";
  // Active includes the last day of the range.
  if (now > c.endsAt.getTime() + 86_400_000) return "done";
  return "active";
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/** Human-friendly relative time in Czech. ("před 5 min", "před 2 h", "26. 4. 2026") */
export function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 0) return formatDate(d); // future
  const min = Math.round(ms / 60_000);
  if (min < 1) return "právě teď";
  if (min < 60) return `před ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `před ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `před ${day} d`;
  return formatDate(d);
}

/** Parse "foo, bar, baz" → ["foo", "bar", "baz"] (trimmed, deduped, ≤16 chars each) */
export function parseTags(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().slice(0, 24);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
