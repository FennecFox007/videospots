// Common DB queries reused across pages.

import {
  and,
  asc,
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
  games,
} from "./client";
import type { CountryGroup } from "@/components/campaign-form-body";

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
  /** Free-text search over name + client + game name (ILIKE %q%). */
  q?: string;
  countryCode?: string;
  chainCode?: string;
  client?: string;
  /** Stored campaign.status value ("approved" | "cancelled"). Mostly legacy. */
  status?: string;
  /** Computed run state — translates to date+status SQL conditions.
   *  Values: "running" | "upcoming" | "done" | "cancelled". */
  runState?: string;
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
 */
export async function findCampaignIds(
  filters: CampaignFilters
): Promise<number[]> {
  const where = await buildWhere(filters);

  // Always join through channels/countries/chains/games so any filter that
  // references those tables resolves correctly. The DISTINCT is required
  // because a campaign with N channels would otherwise return N rows.
  const rows = await db
    .selectDistinct({ id: campaigns.id })
    .from(campaigns)
    .leftJoin(games, eq(campaigns.gameId, games.id))
    .leftJoin(
      campaignChannels,
      eq(campaigns.id, campaignChannels.campaignId)
    )
    .leftJoin(channels, eq(campaignChannels.channelId, channels.id))
    .leftJoin(countries, eq(channels.countryId, countries.id))
    .leftJoin(chains, eq(channels.chainId, chains.id))
    .where(where.expr ?? sql`true`);

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
        ilike(games.name, like)
      )!
    );
  }
  if (filters.countryCode) {
    conds.push(eq(countries.code, filters.countryCode));
  }
  if (filters.chainCode) {
    conds.push(eq(chains.code, filters.chainCode));
  }
  if (filters.client) {
    conds.push(eq(campaigns.client, filters.client));
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
 * to compute on every page load given our row counts.
 */
export async function getFilterOptions() {
  const [allCountries, allChains, clientRows, tagRows] = await Promise.all([
    db.select().from(countries).orderBy(asc(countries.sortOrder)),
    db.select().from(chains).orderBy(asc(chains.sortOrder)),
    db
      .selectDistinct({ client: campaigns.client })
      .from(campaigns)
      .where(sql`${campaigns.client} IS NOT NULL`),
    db.execute<{ tag: string }>(
      sql`SELECT DISTINCT unnest(${campaigns.tags}) AS tag FROM ${campaigns} WHERE ${campaigns.tags} IS NOT NULL ORDER BY tag`
    ),
  ]);

  return {
    countries: allCountries.map((c) => ({
      value: c.code,
      label: `${c.flagEmoji ?? ""} ${c.name}`.trim(),
    })),
    chains: allChains.map((c) => ({ value: c.code, label: c.name })),
    clients: clientRows
      .map((r) => r.client)
      .filter((c): c is string => !!c)
      .sort(),
    tags: (tagRows.rows ?? []).map((r) => r.tag).filter(Boolean),
  };
}

/**
 * Fetch campaigns matching filters, with their channel row + game cover for
 * timeline rendering.
 */
export async function fetchTimelineCampaigns(
  ids: number[],
  rangeStart: Date,
  rangeEnd: Date
) {
  if (ids.length === 0) return [];
  return db
    .select({
      campaignId: campaigns.id,
      name: campaigns.name,
      color: campaigns.color,
      status: campaigns.status,
      coverUrl: games.coverUrl,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
      channelId: campaignChannels.channelId,
    })
    .from(campaigns)
    .innerJoin(
      campaignChannels,
      eq(campaigns.id, campaignChannels.campaignId)
    )
    .leftJoin(games, eq(campaigns.gameId, games.id))
    .where(
      and(
        inArray(campaigns.id, ids),
        lte(campaigns.startsAt, rangeEnd),
        gte(campaigns.endsAt, rangeStart)
      )
    );
}
