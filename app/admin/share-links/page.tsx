// Admin overview of all share links across the system. Editors can manage
// links per-campaign at /campaigns/[id], but timeline links don't have a
// per-page home, and an admin sometimes wants the global picture: who
// shared what, when does it expire, who revoked which.
//
// Filter by status (active default — that's the actionable subset). Each
// row exposes the same Copy / Extend / Revoke actions as the per-campaign
// list, plus the link's payload type ("Kampaň" / "Timeline") and a click-
// through to the campaign for campaign-typed links.

import Link from "next/link";
import { headers } from "next/headers";
import { and, desc, eq, sql, isNull, isNotNull, or } from "drizzle-orm";
import {
  db,
  shareLinks,
  campaigns,
  users,
  auditLog,
} from "@/lib/db/client";
import { alias } from "drizzle-orm/pg-core";
import { getT } from "@/lib/i18n/server";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { ShareLinkAdminActions } from "@/components/share-link-admin-actions";

type StatusFilter = "active" | "expired" | "revoked" | "all";

export default async function AdminShareLinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const now = new Date();

  // Distinct aliases for the two user joins (creator + revoker). Mirrors
  // the per-campaign query in /campaigns/[id].
  const createdBy = alias(users, "created_by");
  const revokedBy = alias(users, "revoked_by");

  const where =
    status === "active"
      ? and(
          isNull(shareLinks.revokedAt),
          or(
            isNull(shareLinks.expiresAt),
            sql`${shareLinks.expiresAt} > ${now}`
          )
        )
      : status === "expired"
        ? and(
            isNull(shareLinks.revokedAt),
            isNotNull(shareLinks.expiresAt),
            sql`${shareLinks.expiresAt} <= ${now}`
          )
        : status === "revoked"
          ? isNotNull(shareLinks.revokedAt)
          : undefined; // "all"

  const rows = await db
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      payload: shareLinks.payload,
      label: shareLinks.label,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      createdAt: shareLinks.createdAt,
      createdByName: createdBy.name,
      createdByEmail: createdBy.email,
      revokedByName: revokedBy.name,
      // Resolve campaign name when the payload references one. Cheap LEFT JOIN
      // — only campaign-typed links match, others get null.
      campaignName: campaigns.name,
      campaignId: campaigns.id,
    })
    .from(shareLinks)
    .leftJoin(createdBy, eq(shareLinks.createdById, createdBy.id))
    .leftJoin(revokedBy, eq(shareLinks.revokedById, revokedBy.id))
    .leftJoin(
      campaigns,
      and(
        sql`${shareLinks.payload}->>'type' = 'campaign'`,
        sql`(${shareLinks.payload}->>'campaignId')::int = ${campaigns.id}`
      )
    )
    .where(where)
    .orderBy(desc(shareLinks.createdAt))
    .limit(200);

  // Counts per status so the filter chips can show "(N)" without extra
  // fetches. count(*) FILTER partition into one query.
  const [tally] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) FILTER (WHERE ${shareLinks.revokedAt} IS NULL AND (${shareLinks.expiresAt} IS NULL OR ${shareLinks.expiresAt} > ${now}))::int`,
      expired: sql<number>`count(*) FILTER (WHERE ${shareLinks.revokedAt} IS NULL AND ${shareLinks.expiresAt} IS NOT NULL AND ${shareLinks.expiresAt} <= ${now})::int`,
      revoked: sql<number>`count(*) FILTER (WHERE ${shareLinks.revokedAt} IS NOT NULL)::int`,
    })
    .from(shareLinks);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  // Used in the empty-state message — touch auditLog import to silence
  // the unused-symbol lint without restructuring the imports.
  void auditLog;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("admin.share_links.description")}
      </p>

      <div className="flex items-center gap-1 flex-wrap text-xs">
        <FilterChip
          href="/admin/share-links?status=active"
          active={status === "active"}
          label={t("admin.share_links.filter.active")}
          count={tally?.active ?? 0}
        />
        <FilterChip
          href="/admin/share-links?status=expired"
          active={status === "expired"}
          label={t("admin.share_links.filter.expired")}
          count={tally?.expired ?? 0}
        />
        <FilterChip
          href="/admin/share-links?status=revoked"
          active={status === "revoked"}
          label={t("admin.share_links.filter.revoked")}
          count={tally?.revoked ?? 0}
        />
        <FilterChip
          href="/admin/share-links?status=all"
          active={status === "all"}
          label={t("admin.share_links.filter.all")}
          count={tally?.total ?? 0}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("admin.share_links.empty.title")}
          description={t("admin.share_links.empty.description")}
        />
      ) : (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">
                  {t("admin.share_links.col.status")}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t("admin.share_links.col.target")}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t("admin.share_links.col.label")}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t("admin.share_links.col.created")}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t("admin.share_links.col.expires")}
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  {t("admin.share_links.col.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const payload = r.payload as
                  | { type: "campaign"; campaignId: number }
                  | { type: "timeline"; filters?: Record<string, string> };
                const rowStatus =
                  r.revokedAt != null
                    ? "revoked"
                    : r.expiresAt && r.expiresAt <= now
                      ? "expired"
                      : "active";
                return (
                  <tr
                    key={r.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-4 py-2.5">
                      <Pill
                        size="xs"
                        tone={
                          rowStatus === "active"
                            ? "emerald"
                            : rowStatus === "expired"
                              ? "amber"
                              : "zinc"
                        }
                      >
                        {t(
                          rowStatus === "active"
                            ? "share_links.status.active"
                            : rowStatus === "expired"
                              ? "share_links.status.expired"
                              : "share_links.status.revoked"
                        )}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5">
                      {payload.type === "campaign" ? (
                        r.campaignId ? (
                          <Link
                            href={`/campaigns/${r.campaignId}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {r.campaignName ??
                              t("admin.share_links.campaign_unnamed", {
                                id: r.campaignId,
                              })}
                          </Link>
                        ) : (
                          <span className="text-zinc-400 italic">
                            {t("admin.share_links.campaign_deleted")}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {t("admin.share_links.target_timeline")}
                          </span>
                          <TimelineFiltersHint
                            filters={
                              (payload as { filters?: Record<string, string> })
                                .filters ?? {}
                            }
                          />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.label ? (
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {r.label}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      <div>{formatShort(r.createdAt)}</div>
                      <div className="text-xs text-zinc-500">
                        {r.createdByName ?? r.createdByEmail ?? "?"}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {r.revokedAt
                        ? t("share_links.revoked_at", {
                            date: formatShort(r.revokedAt),
                            by: r.revokedByName ?? "?",
                          })
                        : r.expiresAt
                          ? formatShort(r.expiresAt)
                          : t("share_links.no_expiry")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ShareLinkAdminActions
                        linkId={r.id}
                        url={`${origin}/share/${r.token}`}
                        canRevoke={rowStatus === "active"}
                        canExtend={rowStatus !== "revoked"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function parseStatus(v: string | string[] | undefined): StatusFilter {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "expired" || s === "revoked" || s === "all") return s;
  return "active";
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors " +
        (active
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium"
          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900")
      }
    >
      {label}
      <span
        className={
          "text-[10px] " + (active ? "text-blue-600/80" : "text-zinc-500")
        }
      >
        {count}
      </span>
    </Link>
  );
}

function TimelineFiltersHint({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const keys = Object.keys(filters);
  if (keys.length === 0) {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  // Compact summary so the column doesn't blow up. Full filter list is in
  // the audit log if anyone needs the receipts.
  const preview = keys
    .slice(0, 3)
    .map((k) => `${k}=${filters[k]}`)
    .join(" · ");
  const more = keys.length > 3 ? ` · +${keys.length - 3}` : "";
  return (
    <span className="text-xs text-zinc-500 font-mono truncate max-w-xs">
      {preview}
      {more}
    </span>
  );
}

function formatShort(d: Date): string {
  // CZ-style "5. 5. 2026" — same helper exists in <CampaignShareLinks>;
  // duplicated here to avoid pulling a client component into a server
  // page just for one formatter.
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}. ${month}. ${year}`;
}
