// /spots — library of all video creatives the agency has registered or
// the campaign forms auto-created. Each row shows the spot, its product,
// country, and how many active campaigns currently use it. The default
// view filters to undeployed spots so "we made this video and forgot to
// schedule it" stops happening (partner's explicit V2 ask).
//
// View modes via ?view=:
//   - all (default if no filter)
//   - undeployed (spots not currently in any non-archived campaign)
//   - deployed
//   - archived
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

type View = "all" | "undeployed" | "deployed" | "archived";

function parseView(v: string | undefined): View {
  if (v === "all" || v === "deployed" || v === "archived") return v;
  return "undeployed";
}

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view = parseView(sp.view);
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
      countryCode: countries.code,
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
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

  // Apply view filter in JS — the deployment count is computed per row
  // anyway, and JS partitioning keeps the query simple.
  const filtered = rows.filter((r) => {
    if (view === "archived") return r.archivedAt !== null;
    if (r.archivedAt !== null) return false;
    if (view === "undeployed") return r.deployments === 0;
    if (view === "deployed") return r.deployments > 0;
    return true; // "all"
  });

  // Bucket counts for the tab strip — rendered regardless of current view.
  const counts = {
    undeployed: rows.filter((r) => !r.archivedAt && r.deployments === 0).length,
    deployed: rows.filter((r) => !r.archivedAt && r.deployments > 0).length,
    all: rows.filter((r) => !r.archivedAt).length,
    archived: rows.filter((r) => r.archivedAt !== null).length,
  };

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
        />
        <ViewTab
          current={view}
          target="deployed"
          label={t("spots.tab.deployed")}
          count={counts.deployed}
        />
        <ViewTab
          current={view}
          target="all"
          label={t("spots.tab.all")}
          count={counts.all}
        />
        <ViewTab
          current={view}
          target="archived"
          label={t("spots.tab.archived")}
          count={counts.archived}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-5 py-12 text-center text-sm text-zinc-500">
          {view === "undeployed"
            ? t("spots.empty.undeployed")
            : t("spots.empty.generic")}
        </div>
      ) : (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">
                  {t("spots.col.name")}
                </th>
                <th className="text-left px-4 py-2 font-medium">
                  {t("spots.col.product")}
                </th>
                <th className="text-left px-4 py-2 font-medium">
                  {t("spots.col.country")}
                </th>
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
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/spots/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name ??
                        (s.productName
                          ? `${s.productName} · ${s.countryCode}`
                          : `Spot · ${s.countryCode}`)}
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
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{s.countryFlag}</span>
                      {localizedCountryName(s.countryCode, s.countryName, t.locale)}
                    </span>
                  </td>
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
      )}
    </div>
  );
}

function ViewTab({
  current,
  target,
  label,
  count,
  highlight,
}: {
  current: View;
  target: View;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  const active = current === target;
  return (
    <Link
      href={`/spots?view=${target}`}
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
