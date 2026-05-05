"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  products,
  auditLog,
} from "@/lib/db/client";
import { extractSpotsByCountry } from "@/lib/campaign-video-form";
import { isValidCampaignColor, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
import {
  isValidKind,
  DEFAULT_PRODUCT_KIND,
} from "@/lib/products";
import { isValidCommunicationType } from "@/lib/communication";
import { isValidStatus, parseTags } from "@/lib/utils";

/** Shape used in audit log to record a value change. */
type Diff<T> = { from: T; to: T };

/** Helper: include a diff entry only when the value actually changed. */
function diff<T>(
  prev: T,
  next: T,
  equal: (a: T, b: T) => boolean = (a, b) => a === b
): Diff<T> | null {
  return equal(prev, next) ? null : { from: prev, to: next };
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function datesEqual(a: Date | null, b: Date | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

const schema = z
  .object({
    name: z.string().min(1, "Název kampaně je povinný"),
    client: z.string().optional().nullable(),
    color: z.string().optional(),
    status: z.string().optional(),
    communicationType: z.string().optional(),
    tags: z.array(z.string()).optional(),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    notes: z.string().optional().nullable(),
    channelIds: z
      .array(z.coerce.number().int().positive())
      .min(1, "Vyber alespoň jeden kanál"),
    productName: z.string().optional(),
    productKind: z.string().optional(),
    productReleaseDate: z.string().optional(),
    productCoverUrl: z.string().optional(),
    productSummary: z.string().optional(),
  })
  .refine((d) => new Date(d.endsAt) >= new Date(d.startsAt), {
    message: "Konec musí být stejný nebo pozdější než začátek",
    path: ["endsAt"],
  });

export async function updateCampaign(campaignId: number, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const channelIds = formData
    .getAll("channelIds")
    .map((v) => String(v))
    .filter(Boolean);

  const productName = String(formData.get("productName") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");

  // Per-country spot picks — keyed inputs spotId_<countryId>.
  const spotsByCountry = extractSpotsByCountry(formData);

  const parsed = schema.parse({
    name: formData.get("name"),
    client: formData.get("client") || undefined,
    color: colorRaw || undefined,
    status: statusRaw || undefined,
    communicationType: formData.get("communicationType") || undefined,
    tags: parseTags(tagsRaw),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    notes: formData.get("notes") || undefined,
    channelIds,
    productName: productName || undefined,
    productKind: formData.get("productKind") || undefined,
    productReleaseDate: formData.get("productReleaseDate") || undefined,
    productCoverUrl: formData.get("productCoverUrl") || undefined,
    productSummary: formData.get("productSummary") || undefined,
  });

  const color =
    parsed.color && isValidCampaignColor(parsed.color)
      ? parsed.color
      : DEFAULT_CAMPAIGN_COLOR;
  const status =
    parsed.status && isValidStatus(parsed.status) ? parsed.status : "approved";
  const communicationType =
    parsed.communicationType &&
    isValidCommunicationType(parsed.communicationType)
      ? parsed.communicationType
      : null;

  const productKind =
    parsed.productKind && isValidKind(parsed.productKind)
      ? parsed.productKind
      : DEFAULT_PRODUCT_KIND;

  // Snapshot the BEFORE state so we can compute a diff for the audit log.
  const [before] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!before) throw new Error("Kampaň neexistuje");

  const beforeChannelRows = await db
    .select({ channelId: campaignChannels.channelId })
    .from(campaignChannels)
    .where(eq(campaignChannels.campaignId, campaignId))
    .orderBy(asc(campaignChannels.channelId));
  const beforeChannelIds = beforeChannelRows.map((r) => r.channelId).sort(
    (a, b) => a - b
  );

  // Snapshot existing per-country spot assignments so the audit log can
  // show what changed. Comparing "<countryId>:<spotId>" sorted arrays is
  // enough for "did this set of (country → spot) mappings change?".
  const beforeVideos = await db
    .select({
      countryId: campaignVideos.countryId,
      spotId: campaignVideos.spotId,
    })
    .from(campaignVideos)
    .where(eq(campaignVideos.campaignId, campaignId))
    .orderBy(asc(campaignVideos.countryId));
  const beforeVideosKey = beforeVideos
    .map((v) => `${v.countryId}:${v.spotId}`)
    .sort();
  const newVideosKey = spotsByCountry
    .map((v) => `${v.countryId}:${v.spotId}`)
    .sort();

  let beforeProductName: string | null = null;
  if (before.productId !== null) {
    const [bp] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, before.productId))
      .limit(1);
    beforeProductName = bp?.name ?? null;
  }

  let productId: number | null = null;
  if (parsed.productName) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(sql`lower(${products.name}) = lower(${parsed.productName})`)
      .limit(1);

    if (existing.length > 0) {
      productId = existing[0].id;
      await db
        .update(products)
        .set({
          kind: productKind,
          coverUrl: parsed.productCoverUrl || null,
          summary: parsed.productSummary || null,
          releaseDate: parsed.productReleaseDate
            ? new Date(parsed.productReleaseDate)
            : null,
        })
        .where(eq(products.id, productId));
    } else {
      const [inserted] = await db
        .insert(products)
        .values({
          name: parsed.productName,
          kind: productKind,
          coverUrl: parsed.productCoverUrl || null,
          summary: parsed.productSummary || null,
          releaseDate: parsed.productReleaseDate
            ? new Date(parsed.productReleaseDate)
            : null,
        })
        .returning({ id: products.id });
      productId = inserted.id;
    }
  }

  await db
    .update(campaigns)
    .set({
      name: parsed.name,
      client: parsed.client || null,
      color,
      status,
      communicationType,
      tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : null,
      productId,
      startsAt: new Date(parsed.startsAt),
      endsAt: new Date(parsed.endsAt),
      notes: parsed.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  await db
    .delete(campaignChannels)
    .where(eq(campaignChannels.campaignId, campaignId));

  await db.insert(campaignChannels).values(
    parsed.channelIds.map((channelId) => ({
      campaignId,
      channelId,
    }))
  );

  // Replace per-country spot assignments: delete-all + re-insert. The
  // form sends spot ids picked from the dropdown, so each (countryId,
  // spotId) goes straight into campaign_video. Spots that the user
  // un-picked stay in the spots table — they show up on /spots as
  // undeployed and can be archived there. We never auto-delete spots
  // because another campaign might still reference them.
  await db
    .delete(campaignVideos)
    .where(eq(campaignVideos.campaignId, campaignId));
  if (spotsByCountry.length > 0) {
    await db.insert(campaignVideos).values(
      spotsByCountry.map((v) => ({
        campaignId,
        countryId: v.countryId,
        spotId: v.spotId,
      }))
    );
  }

  // Build diff: only include fields that actually changed. Each entry is
  // {from, to}; the renderer (campaign detail page) walks the object and
  // produces a Czech-language one-line summary like
  //     "Honza upravil — termín 1. 5. → 3. 5., kanálů 6 → 7"
  const newChannelIds = [...parsed.channelIds].sort((a, b) => a - b);
  const newTags = parsed.tags && parsed.tags.length > 0 ? parsed.tags : null;
  const newProductName = parsed.productName || null;

  const changes: Record<string, unknown> = {};
  const add = (key: string, d: Diff<unknown> | null) => {
    if (d !== null) changes[key] = d;
  };

  add("name", diff<string>(before.name, parsed.name));
  add("client", diff<string | null>(before.client, parsed.client || null));
  // Per-country videos: capture a single audit entry that shows the count
  // before and after. Renderer treats `videos` like `channels` — count diff.
  add(
    "videos",
    diff(beforeVideosKey, newVideosKey, (a, b) =>
      a.length === b.length && a.every((v, i) => v === b[i])
    )
  );
  add("color", diff<string>(before.color, color));
  add("status", diff<string>(before.status, status));
  add(
    "communicationType",
    diff<string | null>(before.communicationType, communicationType)
  );
  add("notes", diff<string | null>(before.notes, parsed.notes || null));
  add("tags", diff(before.tags ?? null, newTags, arraysEqual));
  add(
    "startsAt",
    diff(before.startsAt, new Date(parsed.startsAt), (a, b) => datesEqual(a, b))
  );
  add(
    "endsAt",
    diff(before.endsAt, new Date(parsed.endsAt), (a, b) => datesEqual(a, b))
  );
  add(
    "productName",
    diff<string | null>(beforeProductName, newProductName)
  );
  add(
    "channels",
    diff(beforeChannelIds, newChannelIds, (a, b) =>
      arraysEqual(a.map(String), b.map(String))
    )
  );

  // Only write to audit log if anything actually changed.
  if (Object.keys(changes).length > 0) {
    await db.insert(auditLog).values({
      action: "updated",
      entity: "campaign",
      entityId: campaignId,
      userId: session.user.id,
      changes,
    });
  }

  redirect(`/campaigns/${campaignId}`);
}
