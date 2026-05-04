"use client";

// "Schvaluji" card shown to public viewers on /share/<token>. Two states:
//  - Not yet approved → form with optional comment + submit button
//  - Already approved → green "Schváleno [datum]" badge, no form
//
// Permanent approval (per partner): once approvedAt is set, it stays. The
// agency can see this and trust it; subsequent edits don't invalidate.
//
// Re-used in two places:
//  - Single-campaign share view (full card at top)
//  - Timeline share modal (compact variant inside the bar peek)
// The `compact` prop flips between the two visual modes.

import { useState } from "react";

type Props = {
  /** Share token from the URL — included in the POST so the server can
   *  validate the caller has the link. */
  token: string;
  campaignId: number;
  initialApprovedAt: Date | null;
  /** When true: render the dense modal-friendly version (no card chrome,
   *  smaller paddings). Default false = full card for the standalone
   *  campaign share page. */
  compact?: boolean;
};

export function PublicApproveCard({
  token,
  campaignId,
  initialApprovedAt,
  compact = false,
}: Props) {
  const [approvedAt, setApprovedAt] = useState<Date | null>(
    initialApprovedAt
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, comment: comment.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { approvedAt: string };
      setApprovedAt(new Date(data.approvedAt));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (approvedAt) {
    // Approved-state pill. Same shape in both compact and full mode — a
    // green tick is unambiguous and small enough for either context.
    return (
      <div
        className={
          (compact
            ? "inline-flex items-center gap-1.5 text-xs"
            : "inline-flex items-center gap-2 text-sm rounded-md bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900 px-3 py-2") +
          " text-emerald-800 dark:text-emerald-300"
        }
      >
        <svg
          width={compact ? "12" : "16"}
          height={compact ? "12" : "16"}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 8.5 L7 12 L13 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          Schváleno {formatDateCs(approvedAt)}
        </span>
      </div>
    );
  }

  // Not approved yet — form.
  if (compact) {
    return (
      <div className="space-y-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Komentář (nepovinné)…"
          rows={2}
          maxLength={2000}
          disabled={submitting}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting}
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50"
        >
          {submitting ? "Odesílám…" : "Schvaluji"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900 px-5 py-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Tato kampaň čeká na schválení
        </h3>
        <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
          Pokud kampaň souhlasí s tím, jak má běžet, klikni na „Schvaluji".
          Případně přidej komentář pro tým.
        </p>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Komentář (nepovinné)…"
        rows={3}
        maxLength={2000}
        disabled={submitting}
        className="w-full rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-50"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting}
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "Odesílám…" : "Schvaluji"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function formatDateCs(d: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
