// Release calendar — products with a future (or recent past) releaseDate,
// grouped by month. Shows campaign coverage at a glance and lets the user
// jump from "this game is launching in 3 weeks" to "create a Launch campaign
// for it" in one click.

import Link from "next/link";
import { asc, gte, inArray, sql } from "drizzle-orm";
import { db, products, campaigns } from "@/lib/db/client";
import {
  formatDate,
  formatMonthName,
  toDateInputValue,
  addDays,
} from "@/lib/utils";
import { kindEmoji, kindLabel } from "@/lib/products";
import { getT, makeT } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui/empty-state";

const ONE_DAY_MS = 86_400_000;
// Look back this far so a release that just happened still appears at the top
// of the list with a "Out now" status.
const LOOKBACK_DAYS = 14;

export default async function ReleasesPage() {
  const t = await getT();
  const localeTag = t.locale === "en" ? "en-US" : "cs-CZ";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizonStart = addDays(now, -LOOKBACK_DAYS);

  const releaseRows = await db
    .select({
      id: products.id,
      name: products.name,
      kind: products.kind,
      coverUrl: products.coverUrl,
      summary: products.summary,
      releaseDate: products.releaseDate,
    })
    .from(products)
    .where(gte(products.releaseDate, horizonStart))
    .orderBy(asc(products.releaseDate), asc(products.name));

  // Campaign counts per product (only the upcoming-ish set).
  const productIds = releaseRows.map((r) => r.id);
  const counts =
    productIds.length === 0
      ? []
      : await db
          .select({
            productId: campaigns.productId,
            count: sql<number>`count(*)::int`,
          })
          .from(campaigns)
          .where(inArray(campaigns.productId, productIds))
          .groupBy(campaigns.productId);
  const countByProduct = new Map(
    counts
      .filter((r): r is { productId: number; count: number } => r.productId !== null)
      .map((r) => [r.productId, r.count])
  );

  // Group by month-of-release.
  type Group = {
    key: string; // "2026-05"
    label: string; // "květen 2026"
    rows: typeof releaseRows;
  };
  const groupMap = new Map<string, Group>();
  for (const r of releaseRows) {
    if (!r.releaseDate) continue;
    const d = r.releaseDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        label: `${formatMonthName(d, localeTag)} ${d.getFullYear()}`,
        rows: [],
      });
    }
    groupMap.get(key)!.rows.push(r);
  }
  const groups = Array.from(groupMap.values());

  const totalUpcoming = releaseRows.filter(
    (r) => r.releaseDate && r.releaseDate >= now
  ).length;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("releases.heading")}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {totalUpcoming}{" "}
            {t.plural(totalUpcoming, "unit.product")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {t("releases.timeline")}
          </Link>
          <Link
            href="/admin/products"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {t("releases.manage_products")}
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          description={
            <>
              {t("releases.empty")}{" "}
              <Link href="/admin/products" className="underline">
                {t("releases.empty_link")}
              </Link>
              .
            </>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section
              key={g.key}
              className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 capitalize text-sm font-semibold">
                {g.label}{" "}
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  {g.rows.length}{" "}
                  {t.plural(g.rows.length, "unit.product").replace(
                    /\sv\spipeline$/,
                    ""
                  )}
                </span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {g.rows.map((r) => {
                  const cnt = countByProduct.get(r.id) ?? 0;
                  const release = r.releaseDate!;
                  const daysUntil = Math.ceil(
                    (release.getTime() - now.getTime()) / ONE_DAY_MS
                  );
                  const status = describeReleaseStatus(daysUntil, t);
                  return (
                    <li
                      key={r.id}
                      className="px-4 py-3 flex items-start gap-3"
                    >
                      {r.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.coverUrl}
                          alt=""
                          className="w-12 h-16 object-cover rounded ring-1 ring-zinc-200 dark:ring-zinc-800 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-xl">
                          {kindEmoji(r.kind)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/admin/products/${r.id}`}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                            <span aria-hidden>{kindEmoji(r.kind)}</span>
                            {kindLabel(r.kind)}
                          </span>
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                              status.classes
                            }
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {t("releases.released_on", {
                            date: formatDate(release),
                          })}
                        </div>
                        {r.summary && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 max-w-2xl">
                            {r.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Link
                          href={
                            cnt > 0
                              ? `/campaigns?q=${encodeURIComponent(r.name)}`
                              : `#`
                          }
                          className={
                            "text-xs " +
                            (cnt > 0
                              ? "text-blue-600 hover:underline"
                              : "text-zinc-400")
                          }
                        >
                          {cnt} {t.plural(cnt, "unit.campaign")}
                        </Link>
                        <Link
                          href={launchCampaignHref(r.name, release)}
                          className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 whitespace-nowrap"
                          title={t("releases.launch_campaign_tooltip")}
                        >
                          {t("releases.launch_campaign")}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function describeReleaseStatus(
  daysUntil: number,
  t: ReturnType<typeof makeT>
): {
  label: string;
  classes: string;
} {
  if (daysUntil < 0) {
    return {
      label: t("releases.status.released_days_ago", {
        n: -daysUntil,
        unit: t.plural(-daysUntil, "unit.day"),
      }),
      classes:
        "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-900",
    };
  }
  if (daysUntil === 0) {
    return {
      label: t("releases.status.today"),
      classes:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-800",
    };
  }
  if (daysUntil <= 7) {
    return {
      label: t("releases.status.in_days", {
        n: daysUntil,
        unit: t.plural(daysUntil, "unit.day"),
      }),
      classes:
        "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900",
    };
  }
  if (daysUntil <= 30) {
    return {
      label: t("releases.status.in_days", {
        n: daysUntil,
        unit: t.plural(daysUntil, "unit.day"),
      }),
      classes:
        "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900",
    };
  }
  return {
    label: t("releases.status.in_days", {
      n: daysUntil,
      unit: t.plural(daysUntil, "unit.day"),
    }),
    classes:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-zinc-700",
  };
}

/**
 * Build a /campaigns/new prefill URL for "launch campaign for this release".
 * Window is release date ± 7 days, communication type pre-selected to "launch".
 */
function launchCampaignHref(productName: string, releaseDate: Date): string {
  const start = addDays(releaseDate, -7);
  const end = addDays(releaseDate, 7);
  const sp = new URLSearchParams();
  sp.set("productName", productName);
  sp.set("from", toDateInputValue(start));
  sp.set("to", toDateInputValue(end));
  sp.set("communicationType", "launch");
  return `/campaigns/new?${sp.toString()}`;
}
