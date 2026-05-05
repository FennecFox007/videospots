"use client";

// URL-driven filter row for /spots — same pattern as <FilterBar /> for
// campaigns, scoped to spot-library facets:
//   ?q=&country=&product=&sort=&group=
//
// Mounted under the view tabs (Nenasazené / Nasazené / Všechny / Archiv).
// The tabs are still primary; these filters intersect with the active tab.
// Search is debounced; selects fire immediately.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export type SpotsFiltersProps = {
  countries: Array<{ code: string; label: string }>;
  products: Array<{ id: number; name: string }>;
};

export function SpotsFilters({ countries, products }: SpotsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useT();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const lastSearchRef = useRef(search);

  // Debounced URL push for the search input — typing into the filter
  // shouldn't queue a router.push every keystroke.
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
  const product = searchParams.get("product") ?? "";
  const approval = searchParams.get("approval") ?? "";
  const sort = searchParams.get("sort") ?? "created";
  const group = searchParams.get("group") ?? "country";

  const hasFilters =
    !!search || !!country || !!product || !!approval || sort !== "created";

  function clearAll() {
    const params = new URLSearchParams(searchParams);
    ["q", "country", "product", "approval", "sort"].forEach((k) =>
      params.delete(k)
    );
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
        placeholder={t("spots.filter.search_placeholder")}
        className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-56"
      />

      <Select
        value={country}
        onChange={(v) => setParam("country", v)}
        options={countries.map((c) => ({ value: c.code, label: c.label }))}
        placeholder={t("filter.all_countries")}
      />

      <Select
        value={product}
        onChange={(v) => setParam("product", v)}
        options={products.map((p) => ({ value: String(p.id), label: p.name }))}
        placeholder={t("spots.filter.all_products")}
      />

      <Select
        value={approval}
        onChange={(v) => setParam("approval", v)}
        options={[
          { value: "pending", label: t("spots.filter.approval.pending") },
          { value: "approved", label: t("spots.filter.approval.approved") },
        ]}
        placeholder={t("spots.filter.approval.all")}
      />

      <Select
        value={sort}
        onChange={(v) => setParam("sort", v === "created" ? "" : v)}
        options={[
          { value: "created", label: t("spots.filter.sort.created") },
          { value: "name", label: t("spots.filter.sort.name") },
          { value: "deployments", label: t("spots.filter.sort.deployments") },
        ]}
        // No placeholder — "created" is the default and we want it visible.
        forceFallback={false}
      />

      {/* Group toggle. Two-state pill: "Po zemích" vs "Plochý seznam". */}
      <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setParam("group", group === "country" ? "" : "country")}
          className={
            "px-2.5 py-1 transition-colors " +
            (group !== "flat"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border-r border-zinc-300 dark:border-zinc-700")
          }
          title={t("spots.filter.group.country_tooltip")}
        >
          {t("spots.filter.group.country")}
        </button>
        <button
          type="button"
          onClick={() => setParam("group", "flat")}
          className={
            "px-2.5 py-1 transition-colors " +
            (group === "flat"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-300 dark:border-zinc-700")
          }
          title={t("spots.filter.group.flat_tooltip")}
        >
          {t("spots.filter.group.flat")}
        </button>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
        >
          {t("common.clear_filters")}
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
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  forceFallback?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
