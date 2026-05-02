"use client";

// CSV import UI. The user picks a file → we parse client-side → render a
// preview table with per-row errors → on confirm, post the parsed rows to the
// server action which re-validates and inserts. Two-step flow keeps the file
// itself out of the server roundtrip.

import { useState, useTransition } from "react";
import {
  importCampaignsCsv,
  type ImportRow,
  type ImportResult,
} from "@/app/admin/import/actions";

type ParsedRow = ImportRow & { _rowIndex: number; _warnings: string[] };

const REQUIRED_COLUMNS = ["name", "startsAt", "endsAt", "channels"];
const KNOWN_COLUMNS = [
  "name",
  "client",
  "productName",
  "productKind",
  "startsAt",
  "endsAt",
  "color",
  "tags",
  "channels",
];

export function CsvImport() {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headerMissing, setHeaderMissing] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    setResult(null);
    setParseError(null);
    setHeaderMissing([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const csv = parseCsv(text);
        if (csv.length < 2) {
          setParseError("Soubor je prázdný nebo obsahuje jen hlavičku.");
          setRows(null);
          return;
        }
        const header = csv[0].map((h) => h.trim());
        const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
        if (missing.length > 0) setHeaderMissing(missing);

        const parsed: ParsedRow[] = [];
        for (let i = 1; i < csv.length; i++) {
          const cols = csv[i];
          if (cols.length === 1 && cols[0] === "") continue; // empty line
          const rec: Record<string, string> = {};
          for (let j = 0; j < header.length; j++) {
            rec[header[j]] = (cols[j] ?? "").trim();
          }
          const warnings: string[] = [];
          for (const c of REQUIRED_COLUMNS) {
            if (!rec[c]) warnings.push(`chybí ${c}`);
          }
          parsed.push({
            _rowIndex: i,
            _warnings: warnings,
            name: rec.name ?? "",
            client: rec.client || undefined,
            // Accept both productName (current) and gameName (legacy) headers.
            productName: rec.productName || rec.gameName || undefined,
            productKind: rec.productKind || undefined,
            startsAt: rec.startsAt ?? "",
            endsAt: rec.endsAt ?? "",
            color: rec.color || undefined,
            tags: rec.tags
              ? rec.tags.split(";").map((t) => t.trim()).filter(Boolean)
              : undefined,
            channels: rec.channels
              ? rec.channels
                  .split(";")
                  .map((c) => c.trim())
                  .filter(Boolean)
              : undefined,
          });
        }
        setRows(parsed);
      } catch (e) {
        setParseError((e as Error).message);
        setRows(null);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function submit() {
    if (!rows) return;
    setResult(null);
    const payload: ImportRow[] = rows.map((r) => ({
      name: r.name,
      client: r.client,
      productName: r.productName,
      productKind: r.productKind,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      color: r.color,
      tags: r.tags,
      channels: r.channels,
    }));
    startTransition(async () => {
      try {
        const res = await importCampaignsCsv(payload);
        setResult(res);
      } catch (e) {
        setResult({
          imported: 0,
          skipped: rows.length,
          errors: [{ rowIndex: -1, message: (e as Error).message }],
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 space-y-3">
        <div>
          <h2 className="font-medium">Formát CSV</h2>
          <p className="text-xs text-zinc-500 mt-1">
            UTF-8, čárka jako oddělovač. První řádek = hlavička. Známé sloupce:{" "}
            <code className="font-mono">{KNOWN_COLUMNS.join(", ")}</code>.
            Povinné: <code className="font-mono">{REQUIRED_COLUMNS.join(", ")}</code>.
            Datumy <code>YYYY-MM-DD</code>. Kanály a štítky oddělené{" "}
            <code>;</code>. Kanály jsou kódy{" "}
            <code className="font-mono">stát-řetězec</code> (např.{" "}
            <code className="font-mono">CZ-alza;SK-nay</code>).
          </p>
        </div>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-blue-700 file:cursor-pointer"
        />

        {parseError && (
          <p className="text-sm text-red-600">{parseError}</p>
        )}
        {headerMissing.length > 0 && (
          <p className="text-sm text-amber-600">
            ⚠ V hlavičce chybí povinné sloupce:{" "}
            <code>{headerMissing.join(", ")}</code>
          </p>
        )}
      </div>

      {rows && rows.length > 0 && !result && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium">
              Náhled: {rows.length} řádků
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={isPending || headerMissing.length > 0}
              className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5"
            >
              {isPending ? "Importuji…" : `Importovat ${rows.length} kampaní`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-left sticky top-0">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Název</th>
                  <th className="px-2 py-1.5">Klient</th>
                  <th className="px-2 py-1.5">Produkt</th>
                  <th className="px-2 py-1.5">Začátek</th>
                  <th className="px-2 py-1.5">Konec</th>
                  <th className="px-2 py-1.5">Kanály</th>
                  <th className="px-2 py-1.5">Štítky</th>
                  <th className="px-2 py-1.5">Varování</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._rowIndex}
                    className={
                      "border-t border-zinc-100 dark:border-zinc-800 " +
                      (r._warnings.length > 0
                        ? "bg-amber-50/40 dark:bg-amber-950/20"
                        : "")
                    }
                  >
                    <td className="px-2 py-1 font-mono text-zinc-400">
                      {r._rowIndex + 1}
                    </td>
                    <td className="px-2 py-1 font-medium">{r.name}</td>
                    <td className="px-2 py-1 text-zinc-600 dark:text-zinc-400">
                      {r.client ?? "—"}
                    </td>
                    <td className="px-2 py-1 text-zinc-600 dark:text-zinc-400">
                      {r.productName ?? "—"}
                      {r.productKind && (
                        <span className="ml-1 text-zinc-400">
                          ({r.productKind})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {r.startsAt}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.endsAt}</td>
                    <td className="px-2 py-1 text-zinc-600 dark:text-zinc-400">
                      {r.channels?.length ?? 0} ks
                    </td>
                    <td className="px-2 py-1 text-zinc-600 dark:text-zinc-400">
                      {r.tags?.length ?? 0}
                    </td>
                    <td className="px-2 py-1 text-amber-600">
                      {r._warnings.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div
          className={
            "rounded-lg border p-4 " +
            (result.errors.length === 0
              ? "border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30"
              : "border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30")
          }
        >
          <h3 className="font-medium mb-2">Výsledek</h3>
          <p className="text-sm">
            <span className="font-semibold">
              {result.imported} kampaní importováno
            </span>
            {result.skipped > 0 && `, ${result.skipped} přeskočeno`}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i} className="font-mono">
                  Řádek {e.rowIndex + 1}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** RFC 4180 CSV parser. Handles quoted fields with embedded commas / newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"' && field === "") {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\r") {
        i++;
      } else if (ch === "\n") {
        current.push(field);
        rows.push(current);
        current = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}
