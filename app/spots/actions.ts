"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  spots,
  products,
  campaigns,
  campaignChannels,
  campaignVideos,
  channels,
  auditLog,
} from "@/lib/db/client";
import { isValidKind, DEFAULT_PRODUCT_KIND } from "@/lib/products";
import { isValidCampaignColor, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
import { isValidCommunicationType } from "@/lib/communication";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const upsertSchema = z.object({
  name: z.string().trim().max(200).optional(),
  productName: z.string().trim().max(200).optional(),
  productKind: z.string().trim().max(40).optional(),
  countryId: z.coerce.number().int().positive(),
  videoUrl: z.string().url().max(500),
});

/**
 * Resolve a product by name, creating it if not found. Mirrors the same
 * find-or-create logic the campaign form uses, kept consistent so both
 * surfaces converge on a single product per name.
 */
async function resolveProductId(
  name: string | undefined,
  kindRaw: string | undefined
): Promise<number | null> {
  if (!name) return null;
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(sql`lower(${products.name}) = lower(${name})`)
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const kind = kindRaw && isValidKind(kindRaw) ? kindRaw : DEFAULT_PRODUCT_KIND;
  const [inserted] = await db
    .insert(products)
    .values({ name, kind })
    .returning({ id: products.id });
  return inserted.id;
}

export async function createSpot(formData: FormData) {
  const userId = await requireUser();

  const parsed = upsertSchema.parse({
    name: formData.get("name") || undefined,
    productName: formData.get("productName") || undefined,
    productKind: formData.get("productKind") || undefined,
    countryId: formData.get("countryId"),
    videoUrl: formData.get("videoUrl"),
  });

  const productId = await resolveProductId(
    parsed.productName,
    parsed.productKind
  );

  const [created] = await db
    .insert(spots)
    .values({
      productId,
      countryId: parsed.countryId,
      videoUrl: parsed.videoUrl,
      name: parsed.name || null,
      createdById: userId,
    })
    .returning({ id: spots.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "spot",
    entityId: created.id,
    userId,
    changes: { name: parsed.name ?? null, videoUrl: parsed.videoUrl },
  });

  revalidatePath("/spots");
  redirect("/spots");
}

export async function updateSpot(spotId: number, formData: FormData) {
  const userId = await requireUser();

  const parsed = upsertSchema.parse({
    name: formData.get("name") || undefined,
    productName: formData.get("productName") || undefined,
    productKind: formData.get("productKind") || undefined,
    countryId: formData.get("countryId"),
    videoUrl: formData.get("videoUrl"),
  });

  const productId = await resolveProductId(
    parsed.productName,
    parsed.productKind
  );

  await db
    .update(spots)
    .set({
      productId,
      countryId: parsed.countryId,
      videoUrl: parsed.videoUrl,
      name: parsed.name || null,
    })
    .where(eq(spots.id, spotId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: { name: parsed.name ?? null, videoUrl: parsed.videoUrl },
  });

  revalidatePath("/spots");
  revalidatePath(`/spots/${spotId}`);
  redirect("/spots");
}

export async function archiveSpot(spotId: number) {
  const userId = await requireUser();
  await db
    .update(spots)
    .set({ archivedAt: new Date() })
    .where(eq(spots.id, spotId));
  await db.insert(auditLog).values({
    action: "archived",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: null,
  });
  revalidatePath("/spots");
}

export async function unarchiveSpot(spotId: number) {
  const userId = await requireUser();
  await db
    .update(spots)
    .set({ archivedAt: null })
    .where(eq(spots.id, spotId));
  await db.insert(auditLog).values({
    action: "updated",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: { unarchived: true },
  });
  revalidatePath("/spots");
}

/**
 * Hard delete — only allowed when the spot isn't referenced by any
 * campaign_video row, otherwise the FK (onDelete: restrict) would refuse.
 * We pre-check so the user gets a clean error instead of a DB exception.
 */
export async function deleteSpot(spotId: number) {
  const userId = await requireUser();

  const refs = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(campaignVideos)
    .where(eq(campaignVideos.spotId, spotId));
  if ((refs[0]?.c ?? 0) > 0) {
    throw new Error(
      "Spot je nasazený v jedné nebo víc kampaní. Nejdřív kampaně uprav nebo smaž."
    );
  }

  await db.delete(spots).where(eq(spots.id, spotId));
  await db.insert(auditLog).values({
    action: "deleted",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: null,
  });
  revalidatePath("/spots");
  redirect("/spots");
}

// ---------------------------------------------------------------------------
// createCampaignFromSpot — drag-and-drop entry point
//
// Triggered after the user drags a spot from the timeline-page drawer onto
// a channel row and confirms the modal. Creates a single campaign in the
// spot's country, deploys this spot to that country, and ties together
// however many channels the user picked. Other countries on the campaign
// are left without a spot — the rest of the spots-pending UI surfaces them.
// ---------------------------------------------------------------------------

const fromSpotSchema = z.object({
  spotId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  startsAt: z.string(),
  endsAt: z.string(),
  channelIds: z.array(z.number().int().positive()).min(1),
  color: z.string().optional(),
  communicationType: z.string().optional(),
  approveNow: z.boolean().optional(),
});

export async function createCampaignFromSpot(formData: FormData) {
  const userId = await requireUser();

  // Channels arrive as repeated `channelIds` form fields — the modal
  // renders them as checkboxes named with the same name.
  const channelIdsRaw = formData
    .getAll("channelIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  const parsed = fromSpotSchema.parse({
    spotId: formData.get("spotId"),
    name: formData.get("name"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    channelIds: channelIdsRaw,
    color: formData.get("color") || undefined,
    communicationType: formData.get("communicationType") || undefined,
    approveNow: formData.get("approveNow") === "1",
  });

  // Resolve the spot — we need its productId for the new campaign and its
  // countryId to validate the channel picks.
  const [spot] = await db
    .select({
      id: spots.id,
      productId: spots.productId,
      countryId: spots.countryId,
    })
    .from(spots)
    .where(eq(spots.id, parsed.spotId))
    .limit(1);
  if (!spot) throw new Error("Spot nenalezen.");

  // Belt-and-braces: every selected channel must belong to the spot's
  // country. Same check the modal renders, this guards against form-data
  // tampering.
  const selectedChannels = await db
    .select({ id: channels.id, countryId: channels.countryId })
    .from(channels)
    .where(inArray(channels.id, parsed.channelIds));
  if (selectedChannels.length !== parsed.channelIds.length) {
    throw new Error("Některé vybrané kanály nebyly nalezeny.");
  }
  for (const ch of selectedChannels) {
    if (ch.countryId !== spot.countryId) {
      throw new Error(
        "Kanály musí být ze stejné země jako spot."
      );
    }
  }

  const startsAt = new Date(parsed.startsAt);
  const endsAt = new Date(parsed.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    throw new Error("Neplatný termín.");
  }
  if (endsAt < startsAt) {
    throw new Error("Konec nemůže být před začátkem.");
  }

  const color =
    parsed.color && isValidCampaignColor(parsed.color)
      ? parsed.color
      : DEFAULT_CAMPAIGN_COLOR;
  const communicationType =
    parsed.communicationType &&
    isValidCommunicationType(parsed.communicationType)
      ? parsed.communicationType
      : null;

  const now = new Date();
  const [created] = await db
    .insert(campaigns)
    .values({
      name: parsed.name,
      productId: spot.productId,
      startsAt,
      endsAt,
      color,
      status: "approved",
      communicationType,
      clientApprovedAt: parsed.approveNow ? now : null,
      approvedById: parsed.approveNow ? userId : null,
      createdById: userId,
    })
    .returning({ id: campaigns.id });

  await db.insert(campaignChannels).values(
    parsed.channelIds.map((channelId) => ({
      campaignId: created.id,
      channelId,
    }))
  );

  // Wire the spot to the campaign for its (only) country. Other countries
  // are intentionally left without a spot — the user can attach those
  // later from the edit form, and the spot-pending UI flags them.
  await db.insert(campaignVideos).values({
    campaignId: created.id,
    countryId: spot.countryId,
    spotId: spot.id,
  });

  await db.insert(auditLog).values({
    action: "created",
    entity: "campaign",
    entityId: created.id,
    userId,
    changes: {
      name: parsed.name,
      via: "drag-from-spots",
      spotId: spot.id,
      channelCount: parsed.channelIds.length,
    },
  });

  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath("/spots");
  return { campaignId: created.id };
}
