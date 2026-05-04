"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  products,
  auditLog,
} from "@/lib/db/client";
import { findOrCreateSpot } from "@/lib/spot-resolver";
import { isValidCampaignColor, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
import {
  isValidKind,
  DEFAULT_PRODUCT_KIND,
} from "@/lib/products";
import { isValidCommunicationType } from "@/lib/communication";
import { isValidStatus, parseTags } from "@/lib/utils";
import { extractVideosByCountry } from "@/lib/campaign-video-form";

const schema = z
  .object({
    name: z.string().min(1, "Název kampaně je povinný"),
    client: z.string().optional().nullable(),
    color: z.string().optional(),
    status: z.string().optional(),
    communicationType: z.string().optional(),
    tags: z.array(z.string()).optional(),
    startsAt: z.string().min(1, "Začátek je povinný"),
    endsAt: z.string().min(1, "Konec je povinný"),
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

export async function createCampaign(formData: FormData) {
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

  // Per-country video URLs come in as `videoUrl_<countryId>` form fields
  // (one per country we render in the form). Pull them out before zod parses
  // the rest — schema doesn't validate these, they're a flat URL/empty map.
  const videosByCountry = extractVideosByCountry(formData);

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

  // Find or create the product by case-insensitive name match.
  const productKind =
    parsed.productKind && isValidKind(parsed.productKind)
      ? parsed.productKind
      : DEFAULT_PRODUCT_KIND;

  let productId: number | null = null;
  if (parsed.productName) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(sql`lower(${products.name}) = lower(${parsed.productName})`)
      .limit(1);

    if (existing.length > 0) {
      productId = existing[0].id;
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

  // Recurring series support: when "recurring" checkbox is on we create N
  // campaigns with shifted dates instead of just one.
  const isRecurring = formData.get("recurring") === "1";
  const stepDaysRaw = Number(formData.get("recurringStep") ?? 7);
  const countRaw = Number(formData.get("recurringCount") ?? 1);
  const stepDays = Number.isFinite(stepDaysRaw) && stepDaysRaw > 0 ? stepDaysRaw : 7;
  const occurrences = isRecurring
    ? Math.min(24, Math.max(1, Number.isFinite(countRaw) ? Math.floor(countRaw) : 1))
    : 1;

  const baseStart = new Date(parsed.startsAt).getTime();
  const baseEnd = new Date(parsed.endsAt).getTime();
  const ONE_DAY_MS = 86_400_000;

  const insertedIds: number[] = [];
  for (let i = 0; i < occurrences; i++) {
    const offsetMs = i * stepDays * ONE_DAY_MS;
    const name =
      occurrences > 1 ? `${parsed.name} (${i + 1}/${occurrences})` : parsed.name;

    const [created] = await db
      .insert(campaigns)
      .values({
        name,
        client: parsed.client || null,
        // videoUrl on `campaigns` is the deprecated legacy column — leave it
        // null going forward; per-country URLs go to campaignVideos below.
        videoUrl: null,
        color,
        status,
        communicationType,
        tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : null,
        productId,
        startsAt: new Date(baseStart + offsetMs),
        endsAt: new Date(baseEnd + offsetMs),
        notes: parsed.notes || null,
        createdById: session.user.id,
      })
      .returning({ id: campaigns.id });

    await db.insert(campaignChannels).values(
      parsed.channelIds.map((channelId) => ({
        campaignId: created.id,
        channelId,
      }))
    );

    if (videosByCountry.length > 0) {
      // Each URL flows through findOrCreateSpot: existing (productId,
      // countryId, url) tuples are reused so the spots library doesn't
      // grow duplicates, new tuples create a fresh spot row.
      const inserts: Array<{
        campaignId: number;
        countryId: number;
        spotId: number;
      }> = [];
      for (const v of videosByCountry) {
        const spotId = await findOrCreateSpot({
          productId,
          countryId: v.countryId,
          videoUrl: v.videoUrl,
          userId: session.user.id,
        });
        inserts.push({ campaignId: created.id, countryId: v.countryId, spotId });
      }
      await db.insert(campaignVideos).values(inserts);
    }

    await db.insert(auditLog).values({
      action: "created",
      entity: "campaign",
      entityId: created.id,
      userId: session.user.id,
      changes: {
        name,
        status,
        channelCount: parsed.channelIds.length,
        ...(occurrences > 1
          ? { series: `${i + 1}/${occurrences}`, stepDays }
          : {}),
      },
    });
    insertedIds.push(created.id);
  }

  // For a single campaign go to its detail; for a series land on the list view
  // so the user sees all of them at once.
  redirect(occurrences > 1 ? "/campaigns" : `/campaigns/${insertedIds[0]}`);
}

