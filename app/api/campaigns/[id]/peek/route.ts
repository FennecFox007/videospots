// JSON endpoint for the campaign peek panel. The peek used to be an
// intercepting route at app/@modal/(.)campaigns/[id], but Next.js 16 +
// Turbopack was unstable with two intercepts at the same level
// ((.)campaigns/new + (.)campaigns/[id]) and the dev server kept falling
// over. We replaced the intercept with this plain API endpoint that the
// client-side <CampaignPeek /> reads via fetch — same data, no parallel
// slot, no @modal interaction.

import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  spots,
  channels,
  countries,
  chains,
  products,
  comments,
  users,
} from "@/lib/db/client";

export type CampaignPeekData = {
  campaign: {
    id: number;
    name: string;
    client: string | null;
    color: string;
    status: string;
    communicationType: string | null;
    startsAt: string;
    endsAt: string;
    tags: string[] | null;
    notes: string | null;
    /** ISO timestamp when the campaign was approved, or null if waiting. */
    clientApprovedAt: string | null;
    clientApprovedComment: string | null;
    /** Display name (or email) of who approved. Null when no approval, or
     *  when the original approver got removed from the user table. */
    approvedByName: string | null;
  };
  product: {
    name: string;
    kind: string;
    coverUrl: string | null;
    summary: string | null;
    releaseDate: string | null;
  } | null;
  channels: Array<{
    countryCode: string;
    countryName: string;
    countryFlag: string | null;
    chainName: string;
  }>;
  /** One row per distinct country the campaign runs in. videoUrl is null
   *  when the spot for that country hasn't been assigned yet — common
   *  when a campaign is planned months ahead of spot production. */
  videos: Array<{
    countryCode: string;
    countryName: string;
    countryFlag: string | null;
    videoUrl: string | null;
    spotName: string | null;
  }>;
  recentComments: Array<{
    id: number;
    body: string;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
  }>;
  totalComments: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [row] = await db
    .select({
      campaign: campaigns,
      product: products,
      // Join the user table to surface the approver's display name. Left
      // join because campaigns can be unapproved (and the FK is set-null
      // if a user gets deleted).
      approvedByName: users.name,
      approvedByEmail: users.email,
    })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .leftJoin(users, eq(campaigns.approvedById, users.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [channelRows, videoRows, commentRows] = await Promise.all([
    db
      .select({
        countryCode: countries.code,
        countryName: countries.name,
        countryFlag: countries.flagEmoji,
        chainName: chains.name,
      })
      .from(campaignChannels)
      .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
      .innerJoin(countries, eq(channels.countryId, countries.id))
      .innerJoin(chains, eq(channels.chainId, chains.id))
      .where(eq(campaignChannels.campaignId, campaignId))
      .orderBy(asc(countries.sortOrder), asc(chains.sortOrder)),
    // One row per DISTINCT country the campaign has channels in. Left-
    // join campaign_video → spots so countries without an assigned spot
    // come back with videoUrl=null. The peek UI renders both states —
    // play link if assigned, "spot pending" if not.
    db
      .selectDistinct({
        countryCode: countries.code,
        countryName: countries.name,
        countryFlag: countries.flagEmoji,
        countrySortOrder: countries.sortOrder,
        videoUrl: spots.videoUrl,
        spotName: spots.name,
      })
      .from(campaignChannels)
      .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
      .innerJoin(countries, eq(channels.countryId, countries.id))
      .leftJoin(
        campaignVideos,
        and(
          eq(campaignVideos.campaignId, campaignId),
          eq(campaignVideos.countryId, countries.id)
        )
      )
      .leftJoin(spots, eq(campaignVideos.spotId, spots.id))
      .where(eq(campaignChannels.campaignId, campaignId))
      .orderBy(asc(countries.sortOrder)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        userName: users.name,
        userEmail: users.email,
        total: sql<number>`(count(*) over ())::int`,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.campaignId, campaignId))
      .orderBy(desc(comments.createdAt))
      .limit(3),
  ]);

  const c = row.campaign;
  const product = row.product;

  const data: CampaignPeekData = {
    campaign: {
      id: c.id,
      name: c.name,
      client: c.client,
      color: c.color,
      status: c.status,
      communicationType: c.communicationType,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      tags: c.tags,
      notes: c.notes,
      clientApprovedAt: c.clientApprovedAt?.toISOString() ?? null,
      clientApprovedComment: c.clientApprovedComment,
      approvedByName: row.approvedByName ?? row.approvedByEmail ?? null,
    },
    product: product
      ? {
          name: product.name,
          kind: product.kind,
          coverUrl: product.coverUrl,
          summary: product.summary,
          releaseDate: product.releaseDate?.toISOString() ?? null,
        }
      : null,
    channels: channelRows,
    videos: videoRows.map((v) => ({
      countryCode: v.countryCode,
      countryName: v.countryName,
      countryFlag: v.countryFlag,
      videoUrl: v.videoUrl,
      spotName: v.spotName,
    })),
    recentComments: commentRows.map((cm) => ({
      id: cm.id,
      body: cm.body,
      createdAt: cm.createdAt.toISOString(),
      userName: cm.userName,
      userEmail: cm.userEmail,
    })),
    totalComments: commentRows[0]?.total ?? 0,
  };

  return NextResponse.json(data);
}
