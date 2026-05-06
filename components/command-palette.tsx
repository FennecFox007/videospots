"use client";

// Cmd+K (or Ctrl+K) global search palette. Mounted once in the root layout;
// listens for the shortcut anywhere in the app.
//
// Keyboard: ↑/↓ navigate, Enter open, Esc close. Click also works.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Global open/close shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Avoid hijacking when an input is focused with the same combo? K+meta is
      // pretty distinctive, fine to accept globally.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Debounced fetch on query change.
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      setActive(0);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const data = (await res.json()) as SearchResult[];
          setResults(Array.isArray(data) ? data : []);
          setActive(0);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          // swallow — the palette is best-effort
        }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open]);

  // Reset query when reopening.
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  function go(r: SearchResult) {
    setOpen(false);
    router.push(r.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
      onMouseDown={(e) => {
        // Close when clicking the backdrop (not the panel).
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-xl rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <Search aria-hidden className="w-4 h-4 text-zinc-400" strokeWidth={2} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Hledat spoty, videa, produkty…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5">
            Esc
          </kbd>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Začni psát… (například „Saros", „SIE", „CZ", „youtu")
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Žádné výsledky
            </div>
          )}
          <ul className="py-1">
            {results.map((r, i) => (
              <li key={`${r.type}-${r.id ?? r.label}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2 text-left " +
                    (i === active
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-950")
                  }
                >
                  {r.color ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: r.color }}
                    />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-zinc-300 dark:bg-zinc-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{r.label}</div>
                    {r.sub && (
                      <div className="text-xs text-zinc-500 truncate">
                        {r.sub}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wide">
                    {/* In the new vocabulary: r.type "campaign" is the
                        planned spot (label "spot"), r.type "spot" is a
                        video creative (label "video"). DB-side names
                        stay; only UI labels change. */}
                    {r.type === "campaign"
                      ? "spot"
                      : r.type === "spot"
                        ? "video"
                        : "produkt"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-[10px] text-zinc-500 flex items-center gap-3">
          <span>
            <kbd className="border border-zinc-300 dark:border-zinc-700 rounded px-1">↑↓</kbd>{" "}
            navigace
          </span>
          <span>
            <kbd className="border border-zinc-300 dark:border-zinc-700 rounded px-1">↵</kbd>{" "}
            otevřít
          </span>
          <span className="ml-auto">
            <kbd className="border border-zinc-300 dark:border-zinc-700 rounded px-1">⌘K</kbd>{" "}
            otevřít/zavřít
          </span>
        </div>
      </div>
    </div>
  );
}
