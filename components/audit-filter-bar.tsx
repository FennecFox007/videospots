"use client";

// URL-driven filter bar for /admin/audit. Mirrors the campaign FilterBar's
// look but works on different fields (user / action / entity / date range).

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ACTIONS = [
  { value: "created", label: "vytvořeno" },
  { value: "updated", label: "upraveno" },
  { value: "deleted", label: "smazáno" },
  { value: "cancelled", label: "zrušeno" },
];

const ENTITIES = [
  { value: "campaign", label: "spot" },
  { value: "country", label: "stát" },
  { value: "chain", label: "řetězec" },
  { value: "channel", label: "kanál" },
];

type Props = {
  users: { id: string; label: string }[];
};

export function AuditFilterBar({ users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const userId = searchParams.get("user") ?? "";
  const action = searchParams.get("action") ?? "";
  const entity = searchParams.get("entity") ?? "";
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";

  const hasFilters = !!userId || !!action || !!entity || !!fromDate || !!toDate;

  function clearAll() {
    const params = new URLSearchParams(searchParams);
    ["user", "action", "entity", "from", "to"].forEach((k) => params.delete(k));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const inputClass =
    "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={userId}
        onChange={(e) => setParam("user", e.target.value)}
        className={inputClass}
      >
        <option value="">Všichni uživatelé</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>

      <select
        value={action}
        onChange={(e) => setParam("action", e.target.value)}
        className={inputClass}
      >
        <option value="">Všechny akce</option>
        {ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>

      <select
        value={entity}
        onChange={(e) => setParam("entity", e.target.value)}
        className={inputClass}
      >
        <option value="">Všechny entity</option>
        {ENTITIES.map((en) => (
          <option key={en.value} value={en.value}>
            {en.label}
          </option>
        ))}
      </select>

      <label className="inline-flex items-center gap-1 text-xs text-zinc-500">
        Od:
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setParam("from", e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="inline-flex items-center gap-1 text-xs text-zinc-500">
        Do:
        <input
          type="date"
          value={toDate}
          onChange={(e) => setParam("to", e.target.value)}
          className={inputClass}
        />
      </label>

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
