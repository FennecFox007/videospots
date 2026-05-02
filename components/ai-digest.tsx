"use client";

// Inline AI digest button — generates a Czech-language summary of recent
// audit-log activity via Claude. Result stays in component state, so users
// can re-run with a different window without page reload.

import { useState, useTransition } from "react";
import {
  summarizeRecentActivity,
  type AiDigestResult,
} from "@/app/admin/audit/actions";

const PRESETS = [1, 7, 30] as const;

export function AiDigest() {
  const [days, setDays] = useState<(typeof PRESETS)[number]>(7);
  const [result, setResult] = useState<AiDigestResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await summarizeRecentActivity(days);
      setResult(r);
    });
  }

  return (
    <div className="rounded-lg border border-violet-300 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-violet-900 dark:text-violet-200">
          🤖 AI shrnutí
        </span>
        <span className="text-xs text-violet-700 dark:text-violet-400">
          posledních
        </span>
        <div className="inline-flex rounded-md border border-violet-300 dark:border-violet-700 overflow-hidden text-xs">
          {PRESETS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={
                "px-2 py-1 transition-colors " +
                (days === d
                  ? "bg-violet-600 text-white"
                  : "bg-white dark:bg-zinc-900 hover:bg-violet-100 dark:hover:bg-violet-950") +
                (i < PRESETS.length - 1
                  ? " border-r border-violet-300 dark:border-violet-700"
                  : "")
              }
            >
              {d === 1 ? "1 den" : d === 7 ? "týden" : "měsíc"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="ml-auto rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-50"
        >
          {isPending ? "Generuji…" : result ? "Znovu" : "Vygenerovat"}
        </button>
      </div>

      {result && (
        <div className="text-sm">
          {result.ok ? (
            <>
              <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                {result.summary}
              </p>
              <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-2">
                Vygenerováno z {result.entryCount}{" "}
                {result.entryCount === 1
                  ? "záznamu"
                  : result.entryCount < 5
                    ? "záznamů"
                    : "záznamů"}{" "}
                · model claude-sonnet-4-5
              </p>
            </>
          ) : (
            <p className="text-red-700 dark:text-red-400 font-mono text-xs">
              {result.error}
            </p>
          )}
        </div>
      )}

      {!result && !isPending && (
        <p className="text-xs text-violet-700 dark:text-violet-400">
          Vyber časové okno a klikni Vygenerovat — Claude shrne, co se
          v aplikaci dělo.
        </p>
      )}
    </div>
  );
}
