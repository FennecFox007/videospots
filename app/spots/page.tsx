// /spots — library of all video creatives the agency has registered or
// the campaign forms auto-created. Each row shows the spot, its product,
// country, and how many active campaigns currently use it. The default
// view filters to undeployed spots so "we made this video and forgot to
// schedule it" stops happening (partner's explicit V2 ask).
//
// View modes via ?view= (primary axis):
//   - undeployed (default — spots not in any non-archived campaign)
//   - deployed
//   - all
//   - archived
//
// Filters via ?q=&country=&product=&sort=&group= (secondary axis):
//   - q: free-text across name, product, video URL, country
//   - country: ISO code (CZ/SK/HU/PL)
//   - product: numeric id
//   - sort: created (default desc) | name (asc) | deployments (desc)
//   - group: country (default) | flat
//
// Tabs are still primary; filters intersect with the active tab. Default
// view = group-by-country to make 50–200-spot scenarios stay browsable
// without folders. Folders weren't added on purpose: every spot has a
// fixed (country, product, created-at) tuple, so faceted filters give
// the same affordance without the manual organization burden.
//
// Each spot links to /spots/[id] for edit / archive / delete. The list is
// auth-gated like the rest of the app — share recipients don't see this.

import Link from "next/link";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  spots,
  countries,
  products,
  campaignVideos,
  campaigns,
  users,
} from "@/lib/db/client";
import { kindEmoji } from "@/lib/products";
import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";
import { formatDate } from "@/lib/utils";
import { SpotsFilters } from "@/components/spots-filters";

type View = "all" | "undeployed" | "deployed" | "archived";
type Sort = "created" | "name" | "deployments";
type Group = "country" | "flat";

function parseView(v: string | undefined): View {
  if (v === "all" || v === "deployed" || v === "archived") return v;
  return "undeployed";
}

function parseSort(s: string | undefined): Sort {
  if (s === "name" || s === "deployments") return s;
  return "created";
}

function parseGroup(g: string | undefined): Group {
  if (g === "flat") return "flat";
  return "country";
}

type SearchParams = {
  view?: string;
  q?: string;
  country?: string;
  product?: string;
  sort?: string;
  group?: string;
};

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const sort = parseSort(sp.sort);
  const group = parseGroup(sp.group);
  const q = (sp.q ?? "").trim().toLowerCase();
  const countryFilter = sp.country ?? "";
  const productFilter = sp.product ? Number(sp.product) : null;
  const t = await getT();

  // Pull every spot with its product + country + author, plus a count of
  // non-archived campaigns currently referencing it. Single SELECT —
  // small table at our scale, COUNT(*) over campaign_video joined on
  // non-archived campaigns gives us the "deployed in N campaigns" number.
  const rows = await db
    .select({
      id: spots.id,
      videoUrl: spots.videoUrl,
      name: spots.name,
      archivedAt: spots.archivedAt,
      createdAt: spots.createdAt,
      productId: spots.productId,
      productName: products.name,
      productKind: products.kind,
      countryId: countries.id,
      countryCode: countries.code,
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      countrySortOrder: countries.sortOrder,
      authorName: users.name,
      authorEmail: users.email,
      deployments: sql<number>`(
        SELECT count(*)::int
        FROM ${campaignVideos} cv
        INNER JOIN ${campaigns} c ON c.id = cv.campaign_id
        WHERE cv.spot_id = ${spots.id}
          AND c.archived_at IS NULL
      )`,
    })
    .from(spots)
    .leftJoin(products, eq(spots.productId, products.id))
    .innerJoin(countries, eq(spots.countryId, countries.id))
    .leftJoin(users, eq(spots.createdById, users.id))
    .orderBy(asc(countries.sortOrder), desc(spots.createdAt));

  // ---- Apply view (tab) filter
  const viewFiltered = rows.filter((r) => {
    if (view === "archived") return r.archivedAt !== null;
    if (r.archivedAt !== null) return false;
    if (view === "undeployed") return r.deployments === 0;
    if (view === "deployed") return r.deployments > 0;
    return true; // "all"
  });

  // ---- Apply secondary filters (q + country + product)
  const filtered = viewFiltered.filter((r) => {
    if (countryFilter && r.countryCode !== countryFilter) return false;
    if (productFilter !== null && r.productId !== productFilter) return false;
    if (q) {
      const haystack = [
        r.name,
        r.productName,
        r.videoUrl,
        r.countryCode,
        r.countryName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // ---- Apply sort
  filtered.sort((a, b) => {
    switch (sort) {
      case "name": {
        const an = displayName(a);
        const bn = displayName(b);
        return an.localeCompare(bn);
      }
      case "deployments":
        return b.deployments - a.deployments;
      case "created":
      default:
        return b.createdAt.getTime() - a.createdAt.getTime();
    }
  });

  // ---- Bucket counts for the tab strip — always reflect the SECONDARY
  // filters (q + country + product) so the user sees how many spots match
  // their filter set within each view. The view filter itself doesn't
  // apply to the count of view bucket X (that would be circular).
  const matchesSecondary = (r: (typeof rows)[number]) => {
    if (countryFilter && r.countryCode !== countryFilter) return false;
    if (productFilter !== null && r.productId !== productFilter) return false;
    if (q) {
      const haystack = [
        r.name,
        r.productName,
        r.videoUrl,
        r.countryCode,
        r.countryName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };
  const counts = {
    undeployed: rows.filter(
      (r) => !r.archivedAt && r.deployments === 0 && matchesSecondary(r)
    ).length,
    deployed: rows.filter(
      (r) => !r.archivedAt && r.deployments > 0 && matchesSecondary(r)
    ).length,
    all: rows.filter((r) => !r.archivedAt && matchesSecondary(r)).length,
    archived: rows.filter((r) => r.archivedAt !== null && matchesSecondary(r))
      .length,
  };

  // ---- Filter dropdown options. Use the FULL row set (not filtered) so
  // the user can see all available countries/products even if their
  // current filter set returns 0 — otherwise the filter dropdown would
  // shrink as you filter, which is confusing.
  const allCountriesInLib = Array.from(
    new Map(
      rows.map((r) => [
        r.countryCode,
        {
          code: r.countryCode,
          name: r.countryName,
          flag: r.countryFlag,
          sortOrder: r.countrySortOrder,
        },
      ])
    ).values()
  ).sort((a, b) => a.sortOrder - b.sortOrder);
  const countriesForFilter = allCountriesInLib.map((c) => ({
    code: c.code,
    label: `${c.flag ?? ""} ${localizedCountryName(c.code, c.name, t.locale)}`.trim(),
  }));
  const productsForFilter = Array.from(
    new Map(
      rows
        .filter((r) => r.productId !== null && r.productName)
        .map((r) => [r.productId!, { id: r.productId!, name: r.productName! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // ---- Group rows for rendering
  const groupedByCountry = new Map<
    string,
    {
      code: string;
      name: string;
      flag: string | null;
      rows: typeof filtered;
    }
  >();
  if (group === "country") {
    for (const r of filtered) {
      if (!groupedByCountry.has(r.countryCode)) {
        groupedByCountry.set(r.countryCode, {
          code: r.countryCode,
          name: r.countryName,
          flag: r.countryFlag,
          rows: [],
        });
      }
      groupedByCountry.get(r.countryCode)!.rows.push(r);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("spots.heading")}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {t("spots.subhead")}
          </p>
        </div>
        <Link
          href="/spots/new"
          className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
        >
          + {t("spots.new")}
        </Link>
      </div>

      <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden text-sm">
        <ViewTab
          current={view}
          target="undeployed"
          label={t("spots.tab.undeployed")}
          count={counts.undeployed}
          highlight
          carryParams={sp}
        />
        <ViewTab
          current={view}
          target="deployed"
          label={t("spots.tab.deployed")}
          count={counts.deployed}
          carryParams={sp}
        />
        <ViewTab
          current={view}
          target="all"
          label={t("spots.tab.all")}
          count={counts.all}
          carryParams={sp}
        />
        <ViewTab
          current={view}
          target="archived"
          label={t("spots.tab.archived")}
          count={counts.archived}
          carryParams={sp}
        />
      </div>

      <SpotsFilters
        countries={countriesForFilter}
        products={productsForFilter}
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-5 py-12 text-center text-sm text-zinc-500">
          {q || countryFilter || productFilter !== null
            ? t("spots.empty.filtered")
            : view === "undeployed"
              ? t("spots.empty.undeployed")
              : t("spots.empty.generic")}
        </div>
      ) : group === "country" ? (
        <div className="space-y-4">
          {Array.from(groupedByCountry.values())
            .sort((a, b) => {
              // Use sortOrder from countries DB if we have it, fall back to code.
              const aOrder =
                allCountriesInLib.find((c) => c.code === a.code)?.sortOrder ?? 99;
              const bOrder =
                allCountriesInLib.find((c) => c.code === b.code)?.sortOrder ?? 99;
              return aOrder - bOrder;
            })
            .map((g) => (
              <CountrySection
                key={g.code}
                code={g.code}
                name={g.name}
                flag={g.flag}
                rows={g.rows}
                t={t}
              />
            ))}
        </div>
      ) : (
        <SpotTable rows={filtered} t={t} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayName(r: {
  name: string | null;
  productName: string | null;
  countryCode: string;
}): string {
  return (
    r.name ??
    (r.productName ? `${r.productName} · ${r.countryCode}` : `Spot · ${r.countryCode}`)
  );
}

// Build the URL for a tab change while preserving every OTHER URL param.
// Without this, switching tabs would lose your search/country/product/sort.
function tabHref(target: View, sp: SearchParams): string {
  const params = new URLSearchParams();
  if (target !== "undeployed") params.set("view", target);
  if (sp.q) params.set("q", sp.q);
  if (sp.country) params.set("country", sp.country);
  if (sp.product) params.set("product", sp.product);
  if (sp.sort && sp.sort !== "created") params.set("sort", sp.sort);
  if (sp.group && sp.group !== "country") params.set("group", sp.group);
  const qs = params.toString();
  return qs ? `/spots?${qs}` : "/spots";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountrySection({
  code,
  name,
  flag,
  rows,
  t,
}: {
  code: string;
  name: string;
  flag: string | null;
  rows: Array<SpotRow>;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <section className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span aria-hidden>{flag}</span>
          <span>{localizedCountryName(code, name, t.locale)}</span>
          <span className="text-xs font-normal text-zinc-500">
            ({rows.length})
          </span>
        </div>
      </header>
      <SpotTable rows={rows} t={t} hideCountryColumn />
    </section>
  );
}

type SpotRow = {
  id: number;
  videoUrl: string;
  name: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  productId: number | null;
  productName: string | null;
  productKind: string | null;
  countryCode: string;
  countryName: string;
  countryFlag: string | null;
  authorName: string | null;
  authorEmail: string | null;
  deployments: number;
};

function SpotTable({
  rows,
  t,
  hideCountryColumn,
}: {
  rows: SpotRow[];
  t: Awaited<ReturnType<typeof getT>>;
  hideCountryColumn?: boolean;
}) {
  return (
    <div
      className={
        hideCountryColumn
          ? ""
          : "rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden"
      }
    >
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="text-left px-4 py-2 font-medium">
              {t("spots.col.name")}
            </th>
            <th className="text-left px-4 py-2 font-medium">
              {t("spots.col.product")}
            </th>
            {!hideCountryColumn && (
              <th className="text-left px-4 py-2 font-medium">
                {t("spots.col.country")}
              </th>
            )}
            <th className="text-left px-4 py-2 font-medium">
              {t("spots.col.deployments")}
            </th>
            <th className="text-left px-4 py-2 font-medium">
              {t("spots.col.created")}
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0"
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/spots/${s.id}`}
                  className="font-medium hover:underline"
                >
                  {displayName(s)}
                </Link>
                <div className="text-xs text-zinc-500 truncate max-w-md">
                  {s.videoUrl}
                </div>
              </td>
              <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                {s.productName ? (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden>{kindEmoji(s.productKind ?? "game")}</span>
                    {s.productName}
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              {!hideCountryColumn && (
                <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>{s.countryFlag}</span>
                    {localizedCountryName(s.countryCode, s.countryName, t.locale)}
                  </span>
                </td>
              )}
              <td className="px-4 py-2.5">
                {s.deployments > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                    {s.deployments}× {t.plural(s.deployments, "unit.campaign")}
                  </span>
                ) : s.archivedAt ? (
                  <span className="text-xs text-zinc-400">
                    {t("spots.archived_at", { date: formatDate(s.archivedAt) })}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                    {t("spots.undeployed_label")}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-zinc-500">
                {formatDate(s.createdAt)}
                {(s.authorName || s.authorEmail) && (
                  <div className="truncate max-w-[10rem]">
                    {s.authorName ?? s.authorEmail}
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <a
                  href={s.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  aria-label={t("spots.play")}
                  title={t("spots.play")}
                >
                  <svg width="11" height="11" viewBox="0 0 9 9" fill="currentColor" aria-hidden>
                    <path d="M1.5 0.5l6.5 4-6.5 4z" />
                  </svg>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewTab({
  current,
  target,
  label,
  count,
  highlight,
  carryParams,
}: {
  current: View;
  target: View;
  label: string;
  count: number;
  highlight?: boolean;
  carryParams: SearchParams;
}) {
  const active = current === target;
  return (
    <Link
      href={tabHref(target, carryParams)}
      className={
        "px-3 py-1.5 transition-colors flex items-center gap-1.5 " +
        (active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border-r border-zinc-300 dark:border-zinc-700 last:border-r-0")
      }
    >
      <span>{label}</span>
      <span
        className={
          "text-xs " +
          (active
            ? "opacity-70"
            : highlight && count > 0
              ? "text-amber-700 dark:text-amber-400 font-semibold"
              : "text-zinc-500")
        }
      >
        {count}
      </span>
    </Link>
  );
}
