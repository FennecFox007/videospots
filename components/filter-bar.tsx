"use client";

// URL-driven filter bar shared between the dashboard timeline and the
// /campaigns list page. State lives in the URL (?q=&country=&chain=&runState=&tag=)
// so views are bookmarkable and shareable.
//
// Search is debounced to avoid spamming router.push on every keystroke; selects
// fire immediately. Existing range params (?from=&to=) are preserved on every
// update.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COMMUNICATION_TYPES } from "@/lib/communication";

const RUN_STATES = [
  { value: "running", label: "Právě běží" },
  { value: "upcoming", label: "Čeká na start" },
  { value: "done", label: "Doběhlo" },
  { value: "cancelled", label: "Zrušeno" },
] as const;

type Option = { value: string; label: string };

type Props = {
  countries: Option[]; // value = code (CZ/SK/…)
  chains: Option[]; // value = code (alza/…)
  clients: string[]; // distinct client strings
  tags: string[]; // distinct tag strings
};

export function FilterBar({ countries, chains, clients, tags }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const lastSearchRef = useRef(search);

  // Debounced search → URL update.
  useEffect(() => {
    if (search === lastSearchRef.current) return;
    const t = setTimeout(() => {
      setParam("q", search);
      lastSearchRef.current = search;
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const country = searchParams.get("country") ?? "";
  const chain = searchParams.get("chain") ?? "";
  const client = searchParams.get("client") ?? "";
  const runState = searchParams.get("runState") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const commType = searchParams.get("communicationType") ?? "";

  const hasFilters =
    !!search ||
    !!country ||
    !!chain ||
    !!client ||
    !!runState ||
    !!tag ||
    !!commType;

  function clearAll() {
    const params = new URLSearchParams(searchParams);
    [
      "q",
      "country",
      "chain",
      "client",
      "runState",
      "status",
      "tag",
      "communicationType",
    ].forEach((k) => params.delete(k));
    setSearch("");
    lastSearchRef.current = "";
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Hledat (název, klient, hra)…"
        className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-56"
      />

      <Select
        value={country}
        onChange={(v) => setParam("country", v)}
        options={countries}
        placeholder="Všechny státy"
      />
      <Select
        value={chain}
        onChange={(v) => setParam("chain", v)}
        options={chains}
        placeholder="Všechny řetězce"
      />
      <Select
        value={runState}
        onChange={(v) => setParam("runState", v)}
        options={RUN_STATES.map((s) => ({ value: s.value, label: s.label }))}
        placeholder="Všechny stavy"
      />
      <Select
        value={commType}
        onChange={(v) => setParam("communicationType", v)}
        options={COMMUNICATION_TYPES.map((t) => ({
          value: t.value,
          label: t.label,
        }))}
        placeholder="Všechny typy komunikace"
      />
      {clients.length > 0 && (
        <Select
          value={client}
          onChange={(v) => setParam("client", v)}
          options={clients.map((c) => ({ value: c, label: c }))}
          placeholder="Všichni klienti"
        />
      )}
      {tags.length > 0 && (
        <Select
          value={tag}
          onChange={(v) => setParam("tag", v)}
          options={tags.map((t) => ({ value: t, label: `#${t}` }))}
          placeholder="Všechny štítky"
        />
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
        >
          Vyčistit filtry
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
