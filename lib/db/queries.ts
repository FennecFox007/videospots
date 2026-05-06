// Common DB queries reused across pages.

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  channels,
  countries,
  chains,
  campaigns,
  campaignChannels,
  campaignVideos,
  spots,
  products,
  shareLinks,
} from "./client";
import type { SpotOption } from "@/components/campaign-form-body";
import type { CountryGroup } from "@/components/campaign-form-body";
import { getLocale } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";

/**
 * Fetch all channels grouped by country. Used by the campaign create/edit
 * forms to render the (Country × Chain) checkbox tree.
 */
export async function getChannelGroups(): Promise<CountryGroup[]> {
  const rows = await db
    .select({
      channelId: channels.id,
      countryId: countries.id,
      countryCode: countries.code,
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      chainName: chains.name,
    })
    .from(channels)
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id))
    .orderBy(
      asc(countries.sortOrder),
      asc(countries.code),
      asc(chains.sortOrder),
      asc(chains.name)
    );

  const map = new Map<number, CountryGroup>();
  for (const r of rows) {
    if (!map.has(r.countryId)) {
      map.set(r.countryId, {
        id: r.countryId,
        code: r.countryCode,
        name: r.countryName,
        flag: r.countryFlag,
        channels: [],
      });
    }
    map.get(r.countryId)!.channels.push({
      id: r.channelId,
      chainName: r.chainName,
    });
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Campaign filtering — used by dashboard timeline and /campaigns list
// ---------------------------------------------------------------------------

export type CampaignFilters = {
  /** Free-text search over name + client + game name (ILIKE %q%). The
   *  client column is still searched here so typing an agency name in
   *  Cmd+K / search bar still finds matching campaigns — just the
   *  dedicated `?client=` filter dropdown was removed. */
  q?: string;
  countryCode?: string;
  chainCode?: string;
  /** Stored campaign.status value ("approved" | "cancelled"). Mostly legacy. */
  status?: string;
  /** Computed run state — translates to date+status SQL conditions.
   *  Values: "running" | "upcoming" | "done" | "cancelled". */
  runState?: string;
  /** "pending" | "approved" — filter by client approval status. Empty/undef
   *  = both. */
  approval?: string;
  /** When "1", return only campaigns where at least one country has no
   *  assigned spot yet. Useful for the "campaigns waiting for spots"
   *  workflow — agency plans months ahead, spots get attached later. */
  missingSpot?: string;
  tag?: string;
  /** Optional date window (overlap test). */
  rangeStart?: Date;
  rangeEnd?: Date;
  /** When true, include archived campaigns. Default = false (hidden). */
  includeArchived?: boolean;
  /** When true, return only archived campaigns (for /admin/archive). */
  onlyArchived?: boolean;
};

/**
 * Resolve campaign IDs that match the filters. Pulled out as a step because
 * downstream queries (campaigns + their channel rows for the timeline) need to
 * filter by the same set without duplicating join/where logic.
 *
 * Joins are added conditionally — most callers (e.g. /admin/archive,
 * DashboardStats counts) only filter by campaign-table columns and don't
 * need the 5-table join tree at all. Building only the joins each filter
 * actually references keeps the cheap cases cheap.
 */
export async function findCampaignIds(
  filters: CampaignFilters
): Promise<number[]> {
  const where = await buildWhere(filters);
  const condition = where.expr ?? sql`true`;

  // Only `q` reaches into products.name, only countryCode/chainCode reach
  // into the channel tree. Skip the joins entirely when no filter needs them
  // — the campaigns table alone is enough.
  const needsProducts = !!filters.q;
  const needsChannelTree = !!filters.countryCode || !!filters.chainCode;

  if (!needsProducts && !needsChannelTree) {
    const rows = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(condition);
    return rows.map((r) => r.id);
  }

  // Build the join tree only as wide as the active filters need. DISTINCT
  // because the channel tree multiplies rows by N channels per campaign.
  let qb = db.selectDistinct({ id: campaigns.id }).from(campaigns).$dynamic();

  if (needsProducts) {
    qb = qb.leftJoin(products, eq(campaigns.productId, products.id));
  }
  if (needsChannelTree) {
    qb = qb
      .leftJoin(
        campaignChannels,
        eq(campaigns.id, campaignChannels.campaignId)
      )
      .leftJoin(channels, eq(campaignChannels.channelId, channels.id));
    if (filters.countryCode) {
      qb = qb.leftJoin(countries, eq(channels.countryId, countries.id));
    }
    if (filters.chainCode) {
      qb = qb.leftJoin(chains, eq(channels.chainId, chains.id));
    }
  }

  const rows = await qb.where(condition);
  return rows.map((r) => r.id);
}

async function buildWhere(filters: CampaignFilters): Promise<{
  expr: ReturnType<typeof and> | undefined;
  empty: boolean;
}> {
  const conds: ReturnType<typeof eq>[] = [];

  // Archive visibility: default hides archived, /admin/archive shows only archived.
  if (filters.onlyArchived) {
    conds.push(sql`${campaigns.archivedAt} IS NOT NULL`);
  } else if (!filters.includeArchived) {
    conds.push(isNull(campaigns.archivedAt));
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    conds.push(
      or(
        ilike(campaigns.name, like),
        ilike(campaigns.client, like),
        ilike(products.name, like)
      )!
    );
  }
  if (filters.countryCode) {
    conds.push(eq(countries.code, filters.countryCode));
  }
  if (filters.chainCode) {
    conds.push(eq(chains.code, filters.chainCode));
  }
  if (filters.status) {
    conds.push(eq(campaigns.status, filters.status));
  }
  if (filters.runState) {
    const now = new Date();
    switch (filters.runState) {
      case "running":
        conds.push(eq(campaigns.status, "approved"));
        conds.push(lte(campaigns.startsAt, now));
        conds.push(gte(campaigns.endsAt, now));
        break;
      case "upcoming":
        conds.push(eq(campaigns.status, "approved"));
        conds.push(sql`${campaigns.startsAt} > ${now}`);
        break;
      case "done":
        conds.push(eq(campaigns.status, "approved"));
        conds.push(sql`${campaigns.endsAt} < ${now}`);
        break;
      case "cancelled":
        conds.push(eq(campaigns.status, "cancelled"));
        break;
    }
  }
  if (filters.approval === "pending") {
    conds.push(isNull(campaigns.clientApprovedAt));
  } else if (filters.approval === "approved") {
    conds.push(sql`${campaigns.clientApprovedAt} IS NOT NULL`);
  }
  if (filters.missingSpot === "1") {
    // Has at least one channel whose country has no campaign_video row.
    // Phrased as: there exists a campaign_channel without a matching
    // campaign_video for the same (campaign, country) pair.
    conds.push(sql`EXISTS (
      SELECT 1 FROM ${campaignChannels} cc
      INNER JOIN ${channels} ch ON ch.id = cc.channel_id
      WHERE cc.campaign_id = ${campaigns.id}
        AND NOT EXISTS (
          SELECT 1 FROM ${campaignVideos} cv
          WHERE cv.campaign_id = cc.campaign_id
            AND cv.country_id = ch.country_id
        )
    )`);
  }
  if (filters.tag) {
    // Postgres array contains: tags @> ARRAY['tag']
    conds.push(sql`${campaigns.tags} @> ARRAY[${filters.tag}]::text[]`);
  }
  if (filters.rangeStart && filters.rangeEnd) {
    conds.push(lte(campaigns.startsAt, filters.rangeEnd));
    conds.push(gte(campaigns.endsAt, filters.rangeStart));
  }

  // We always have at least the archive filter, so `empty` is never true now.
  if (conds.length === 0) return { expr: undefined, empty: true };
  return { expr: and(...conds), empty: false };
}

/**
 * Distinct values used to populate the FilterBar's dropdowns. Cheap enough
 * to compute on every page load given our row counts. Country names are
 * localized for the current UI locale (the DB only stores Czech names but
 * we resolve via Intl.DisplayNames for English).
 *
 * `clients` and `communicationType` aren't returned anymore — those filters
 * were removed from the FilterBar (partner said the row was too noisy).
 * The columns themselves still exist on campaigns and are shown in detail
 * / table cells; just no longer slicing the list by them.
 */
export async function getFilterOptions() {
  const [allCountries, allChains, tagRows] = await Promise.all([
    db.select().from(countries).orderBy(asc(countries.sortOrder)),
    db.select().from(chains).orderBy(asc(chains.sortOrder)),
    db.execute<{ tag: string }>(
      sql`SELECT DISTINCT unnest(${campaigns.tags}) AS tag FROM ${campaigns} WHERE ${campaigns.tags} IS NOT NULL ORDER BY tag`
    ),
  ]);

  const locale = await getLocale();

  return {
    countries: allCountries.map((c) => ({
      value: c.code,
      label: `${c.flagEmoji ?? ""} ${localizedCountryName(c.code, c.name, locale)}`.trim(),
    })),
    chains: allChains.map((c) => ({ value: c.code, label: c.name })),
    tags: (tagRows.rows ?? []).map((r) => r.tag).filter(Boolean),
  };
}

/**
 * Fetch campaigns matching filters, with their channel row + product cover for
 * timeline rendering.
 */
export async function fetchTimelineCampaigns(
  ids: number[],
  rangeStart: Date,
  rangeEnd: Date
) {
  if (ids.length === 0) return [];
  // Each row = (campaign × channel). The video URL is per-COUNTRY, so we
  // join channels → countries → campaign_video to land the right
  // language version on each bar (CZ Alza bar gets the CZ video, SK bar
  // gets the SK video, etc.). LEFT JOIN because not every (campaign,
  // country) pair has a video set.
  //
  // We return master + override dates as separate raw columns and coalesce
  // in JS rather than via SQL. Reason: Drizzle auto-parses timestamp
  // columns to Date objects only when they're declared with mode: "date"
  // in the schema; raw `sql\`COALESCE(...)\`` expressions skip that mapping
  // and come back as strings, which breaks any downstream code calling
  // `.getTime()` on them. Resolving in JS keeps everything as proper Dates.
  //
  // Range filter still uses MASTER dates (not effective). Edge case: a
  // channel override that pushes a bar entirely outside the master range
  // won't be discovered by this query. In practice partners want overrides
  // to SHRINK the campaign in one channel, not extend it past the master,
  // so this is an acceptable limitation for v1.
  const rows = await db
    .select({
      campaignId: campaigns.id,
      name: campaigns.name,
      color: campaigns.color,
      status: campaigns.status,
      communicationType: campaigns.communicationType,
      clientApprovedAt: campaigns.clientApprovedAt,
      videoUrl: spots.videoUrl,
      // Approval timestamp on the SPOT attached to this (campaign ×
      // country). Drives the bar's hatched-vs-solid visual: solid when
      // the spot has been approved by the client (clientApprovedAt set),
      // hatched otherwise. Null when no spot is attached at all (left
      // join miss); bar then renders the "missing creative" affordance
      // (dashed play-circle) on top of hatched fill.
      spotApprovedAt: spots.clientApprovedAt,
      coverUrl: products.coverUrl,
      masterStartsAt: campaigns.startsAt,
      masterEndsAt: campaigns.endsAt,
      channelStartsAt: campaignChannels.startsAt,
      channelEndsAt: campaignChannels.endsAt,
      channelCancelledAt: campaignChannels.cancelledAt,
      channelId: campaignChannels.channelId,
    })
    .from(campaigns)
    .innerJoin(
      campaignChannels,
      eq(campaigns.id, campaignChannels.campaignId)
    )
    .innerJoin(channels, eq(channels.id, campaignChannels.channelId))
    .leftJoin(
      campaignVideos,
      and(
        eq(campaignVideos.campaignId, campaigns.id),
        eq(campaignVideos.countryId, channels.countryId)
      )
    )
    .leftJoin(spots, eq(campaignVideos.spotId, spots.id))
    .leftJoin(products, eq(campaigns.productId, products.id))
    .where(
      and(
        inArray(campaigns.id, ids),
        lte(campaigns.startsAt, rangeEnd),
        gte(campaigns.endsAt, rangeStart)
      )
    );

  return rows.map((r) => ({
    campaignId: r.campaignId,
    name: r.name,
    color: r.color,
    status: r.status,
    communicationType: r.communicationType,
    clientApprovedAt: r.clientApprovedAt,
    videoUrl: r.videoUrl,
    spotApprovedAt: r.spotApprovedAt,
    coverUrl: r.coverUrl,
    // Effective: per-channel override falls back to master.
    startsAt: r.channelStartsAt ?? r.masterStartsAt,
    endsAt: r.channelEndsAt ?? r.masterEndsAt,
    masterStartsAt: r.masterStartsAt,
    masterEndsAt: r.masterEndsAt,
    channelCancelledAt: r.channelCancelledAt,
    hasChannelOverride:
      r.channelStartsAt !== null ||
      r.channelEndsAt !== null ||
      r.channelCancelledAt !== null,
    channelId: r.channelId,
  }));
}

/**
 * Fetch all non-archived spots, grouped by countryId, ordered with the
 * country's spots sorted newest-first within the group. Used by the
 * campaign create/edit form to populate per-country dropdowns. Includes
 * the joined product name so the dropdown label can be "Saros Launch CZ"
 * even when the spot has no explicit name set.
 */
export async function getSpotsByCountry(): Promise<
  Record<number, SpotOption[]>
> {
  const rows = await db
    .select({
      id: spots.id,
      name: spots.name,
      videoUrl: spots.videoUrl,
      countryId: spots.countryId,
      productName: products.name,
      createdAt: spots.createdAt,
      clientApprovedAt: spots.clientApprovedAt,
    })
    .from(spots)
    .leftJoin(products, eq(spots.productId, products.id))
    .where(isNull(spots.archivedAt))
    .orderBy(asc(spots.countryId), desc(spots.createdAt));

  const grouped: Record<number, SpotOption[]> = {};
  for (const r of rows) {
    if (!grouped[r.countryId]) grouped[r.countryId] = [];
    grouped[r.countryId].push({
      id: r.id,
      name: r.name,
      videoUrl: r.videoUrl,
      productName: r.productName,
      clientApprovedAt: r.clientApprovedAt,
    });
  }
  return grouped;
}

export type DrawerSpot = {
  id: number;
  name: string | null;
  videoUrl: string;
  productName: string | null;
  countryId: number;
  countryCode: string;
  countryFlag: string | null;
  countryName: string;
  /** How many non-archived campaigns currently use this spot. The drawer
   *  shows it as a badge and uses 0-vs-N to populate the "Nenasazené" tab. */
  deployments: number;
  /** Approval timestamp the drawer card uses to render the status dot.
   *  Drawer callers compute the derived state via lib/spot-approval.ts. */
  clientApprovedAt: Date | null;
};

/**
 * Spots for the timeline-page drawer. Same data as the /spots admin page
 * but flattened to a single array (the drawer renders its own grouping).
 * Always fetched server-side at /'s render time so the user can drag
 * straight into the timeline without an API hop.
 */
export async function getSpotsForDrawer(): Promise<DrawerSpot[]> {
  const rows = await db
    .select({
      id: spots.id,
      name: spots.name,
      videoUrl: spots.videoUrl,
      productName: products.name,
      countryId: countries.id,
      countryCode: countries.code,
      countryFlag: countries.flagEmoji,
      countryName: countries.name,
      countrySortOrder: countries.sortOrder,
      deployments: spotDeploymentCountSql(),
      clientApprovedAt: spots.clientApprovedAt,
    })
    .from(spots)
    .leftJoin(products, eq(spots.productId, products.id))
    .innerJoin(countries, eq(spots.countryId, countries.id))
    .where(isNull(spots.archivedAt))
    .orderBy(asc(countries.sortOrder), desc(spots.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    videoUrl: r.videoUrl,
    productName: r.productName,
    countryId: r.countryId,
    countryCode: r.countryCode,
    countryFlag: r.countryFlag,
    countryName: r.countryName,
    deployments: r.deployments,
    clientApprovedAt: r.clientApprovedAt,
  }));
}

// ---------------------------------------------------------------------------
// Shared SQL fragments for spot deployment status
//
// "How many non-archived campaigns currently reference this spot?" was
// inlined in three places (this file's getSpotsForDrawer, /spots admin
// page, dashboard "undeployed spots" tile) with subtly different shapes.
// These helpers consolidate the correlated subquery so the answer can't
// drift across surfaces.
//
// Both helpers expect to be used inside a query that has `spots` in scope
// (typically `db.select(...).from(spots)`); they correlate on
// `cv.spot_id = spots.id`. Outside that context the fragments compile
// fine but reference an undefined alias.
// ---------------------------------------------------------------------------

/** Count of non-archived campaigns deploying the current row's spot. */
export function spotDeploymentCountSql() {
  return sql<number>`(
    SELECT count(*)::int
    FROM ${campaignVideos} cv
    INNER JOIN ${campaigns} c ON c.id = cv.campaign_id
    WHERE cv.spot_id = ${spots.id}
      AND c.archived_at IS NULL
  )`;
}

/** Boolean condition: spot is "undeployed" (no non-archived campaign
 *  references it). Prefer over `spotDeploymentCountSql() = 0` because
 *  Postgres can short-circuit on the first matching row. */
export function spotIsUndeployedSql() {
  return sql`NOT EXISTS (
    SELECT 1
    FROM ${campaignVideos} cv
    INNER JOIN ${campaigns} c ON c.id = cv.campaign_id
    WHERE cv.spot_id = ${spots.id}
      AND c.archived_at IS NULL
  )`;
}

// ---------------------------------------------------------------------------
// Share link helpers — single source of truth for the "active" predicate.
// A link is active iff it hasn't been explicitly revoked AND hasn't passed
// its natural expiry. Used by the public /share/[token] lookup AND the
// per-campaign + admin management lists, so they all agree on what "active"
// means.
// ---------------------------------------------------------------------------

/**
 * Drizzle predicate for "share link is currently active": not revoked AND
 * (no expiry OR expiry in the future). Pass `now` so callers can use a
 * consistent timestamp across multiple queries in the same request.
 */
export function shareLinkIsActive(now: Date) {
  return and(
    isNull(shareLinks.revokedAt),
    or(isNull(shareLinks.expiresAt), sql`${shareLinks.expiresAt} > ${now}`)
  )!;
}

/**
 * Coarse status for UI rendering. Centralised so admin list + per-campaign
 * list agree: "active" (still valid), "expired" (expiresAt passed naturally),
 * "revoked" (an editor disabled it explicitly — wins over expired if both,
 * because an editor's intent is the more informative signal).
 */
export type ShareLinkStatus = "active" | "expired" | "revoked";

export function shareLinkStatus(
  link: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date = new Date()
): ShareLinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && link.expiresAt <= now) return "expired";
  return "active";
}
