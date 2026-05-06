"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
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
import { requireEditor as requireUser } from "@/lib/auth-helpers";
import {
  autoTransitionForUrlChange,
  isProductionStatus,
  shouldInvalidateApprovalOnUrlChange,
  type ProductionStatus,
} from "@/lib/spot-status";

// All spot mutations require editor+ (createSpot, update, archive, delete,
// inline picker create, drag-onto-timeline campaign create). Viewers are
// strictly read-only across the spot library.

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

  // Initial productionStatus: a spot created WITH a videoUrl is already
  // in production (creative is in flight), so it lands in "ve_vyrobe".
  // Without a URL it sits in "bez_zadani". The approval axis (driven
  // by clientApprovedAt) starts at null = "Čeká na schválení" implicitly.
  const initialStatus: ProductionStatus = parsed.videoUrl?.trim()
    ? "ve_vyrobe"
    : "bez_zadani";

  const [created] = await db
    .insert(spots)
    .values({
      productId,
      countryId: parsed.countryId,
      videoUrl: parsed.videoUrl,
      name: parsed.name || null,
      productionStatus: initialStatus,
      createdById: userId,
    })
    .returning({ id: spots.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "spot",
    entityId: created.id,
    userId,
    changes: {
      name: parsed.name ?? null,
      videoUrl: parsed.videoUrl,
      productionStatus: initialStatus,
    },
  });

  revalidatePath("/spots");
  redirect("/spots");
}

/**
 * Same as createSpot but returns the newly created spot instead of
 * redirecting. Used by the inline "+ Nový spot" modal in the campaign
 * form: the caller appends the returned spot to the per-country dropdown
 * and pre-selects it without leaving the page.
 *
 * Returns the minimum the dropdown needs (id, name, productName,
 * videoUrl) — same shape as `SpotOption` so the client can `[...prev,
 * created]` without conversion.
 */
export async function createSpotForPicker(formData: FormData): Promise<{
  id: number;
  name: string | null;
  videoUrl: string;
  productName: string | null;
  countryId: number;
  clientApprovedAt: Date | null;
}> {
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

  // Same initial-status reasoning as createSpot (URL → ve_vyrobe).
  const initialStatus: ProductionStatus = parsed.videoUrl?.trim()
    ? "ve_vyrobe"
    : "bez_zadani";

  const [created] = await db
    .insert(spots)
    .values({
      productId,
      countryId: parsed.countryId,
      videoUrl: parsed.videoUrl,
      name: parsed.name || null,
      productionStatus: initialStatus,
      createdById: userId,
    })
    .returning({ id: spots.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "spot",
    entityId: created.id,
    userId,
    changes: {
      name: parsed.name ?? null,
      videoUrl: parsed.videoUrl,
      productionStatus: initialStatus,
      via: "campaign-form-inline",
    },
  });

  // /spots and / both surface fresh spot lists — keep their caches stale
  // so a follow-up navigation sees the new spot. The CALLING form stays on
  // the campaign page (no redirect), and the dropdown updates locally via
  // the returned object.
  revalidatePath("/spots");
  revalidatePath("/");

  return {
    id: created.id,
    name: parsed.name || null,
    videoUrl: parsed.videoUrl,
    productName: parsed.productName ?? null,
    countryId: parsed.countryId,
    // Fresh spots start pending — both timestamps null until an admin
    // approves.
    clientApprovedAt: null,
  };
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

  // Snapshot the spot pre-update so we can detect a URL swap that should
  // auto-transition productionStatus (and clear approval if relevant).
  const [before] = await db
    .select({
      videoUrl: spots.videoUrl,
      clientApprovedAt: spots.clientApprovedAt,
      productionStatus: spots.productionStatus,
    })
    .from(spots)
    .where(eq(spots.id, spotId))
    .limit(1);
  if (!before) throw new Error("Spot neexistuje");

  const prevStatus = (before.productionStatus ?? "bez_zadani") as ProductionStatus;
  // Two independent rules now (production axis + approval axis):
  //   - URL set first time → bump production from bez_zadani/zadan to
  //     ve_vyrobe ("creative work is in flight"). Editor still owns the
  //     final state (could move it back manually).
  //   - URL replaced AND was approved → wipe approval timestamps.
  //     Production is unaffected on this branch — we don't downgrade
  //     ve_vyrobe back to anything when replacing a video, the creative
  //     is still in production.
  const autoNextStatus = autoTransitionForUrlChange(
    before.videoUrl,
    parsed.videoUrl,
    prevStatus
  );
  const shouldInvalidateApproval = shouldInvalidateApprovalOnUrlChange(
    before.videoUrl,
    parsed.videoUrl,
    before.clientApprovedAt !== null
  );

  const updateValues: Record<string, unknown> = {
    productId,
    countryId: parsed.countryId,
    videoUrl: parsed.videoUrl,
    name: parsed.name || null,
  };
  if (autoNextStatus) {
    updateValues.productionStatus = autoNextStatus;
  }
  if (shouldInvalidateApproval) {
    // Wipe approval state — different creative, prior sign-off no longer
    // applies. Production axis is unaffected here.
    updateValues.clientApprovedAt = null;
    updateValues.clientApprovedComment = null;
    updateValues.approvedById = null;
  }

  await db.update(spots).set(updateValues).where(eq(spots.id, spotId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: {
      name: parsed.name ?? null,
      videoUrl: parsed.videoUrl,
      ...(autoNextStatus
        ? { productionStatusFrom: prevStatus, productionStatusTo: autoNextStatus }
        : {}),
      ...(shouldInvalidateApproval ? { approvalInvalidatedByEdit: true } : {}),
    },
  });

  revalidatePath("/spots");
  revalidatePath(`/spots/${spotId}`);
  redirect("/spots");
}

// ---------------------------------------------------------------------------
// Two independent state axes — see lib/spot-status.ts for the full model.
//
// PRODUCTION axis (manual, agency-controlled): bez_zadani / zadan /
//   ve_vyrobe. Edited via setSpotProductionStatus.
// APPROVAL axis (Sony/client-controlled): derived from clientApprovedAt
//   (null = "Čeká na schválení", set = "Schváleno"). Edited via
//   approveSpot / unapproveSpot — these touch ONLY the approval columns,
//   never productionStatus.
//
// This split lets a spot legitimately be {ve_vyrobe, schvaleno} (Sony
// approved a draft, we're polishing) or any other combo. Auto-rules:
//   - URL set first time on bez_zadani/zadan → bump production to ve_vyrobe
//   - URL replaced AND was approved → wipe approval timestamps (different
//     creative, prior sign-off no longer applies). Production unaffected.
// ---------------------------------------------------------------------------

/** Mark a spot as client-approved. Touches ONLY the approval axis —
 *  productionStatus stays where it was. Optional comment captures
 *  intent (e.g. "approved via email 2026-05-12"). */
export async function approveSpot(spotId: number, comment?: string) {
  const userId = await requireUser();

  const trimmedComment = comment?.trim();
  const now = new Date();

  await db
    .update(spots)
    .set({
      clientApprovedAt: now,
      clientApprovedComment: trimmedComment || null,
      approvedById: userId,
    })
    .where(eq(spots.id, spotId));

  await db.insert(auditLog).values({
    action: "approved",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: { note: trimmedComment ?? null },
  });

  revalidatePath("/spots");
  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/");
}

/** Clear an existing approval — sends the spot back to "Čeká na
 *  schválení" on the approval axis. Production axis is left intact
 *  (so a spot in ve_vyrobe stays ve_vyrobe). For URL/content changes,
 *  updateSpot already wipes approval automatically. */
export async function unapproveSpot(spotId: number) {
  const userId = await requireUser();

  await db
    .update(spots)
    .set({
      clientApprovedAt: null,
      clientApprovedComment: null,
      approvedById: null,
    })
    .where(eq(spots.id, spotId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: { approvalCleared: true },
  });

  revalidatePath("/spots");
  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/");
}

/** Set the production-axis status: bez_zadani / zadan / ve_vyrobe.
 *  Approval axis is independent and untouched here — toggling
 *  production while a spot is approved doesn't reset that approval
 *  (the creative didn't change). Idempotent: setting to current = no-op,
 *  no audit row. */
export async function setSpotProductionStatus(
  spotId: number,
  status: string
) {
  const userId = await requireUser();

  if (!isProductionStatus(status)) {
    throw new Error(`Neplatný stav výroby: ${status}`);
  }

  const [before] = await db
    .select({
      productionStatus: spots.productionStatus,
    })
    .from(spots)
    .where(eq(spots.id, spotId))
    .limit(1);
  if (!before) throw new Error("Spot neexistuje");

  const prevStatus = (before.productionStatus ?? "bez_zadani") as ProductionStatus;
  if (prevStatus === status) return; // idempotent no-op

  await db
    .update(spots)
    .set({ productionStatus: status })
    .where(eq(spots.id, spotId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "spot",
    entityId: spotId,
    userId,
    changes: {
      productionStatusFrom: prevStatus,
      productionStatusTo: status,
    },
  });

  revalidatePath("/spots");
  revalidatePath(`/spots/${spotId}`);
  revalidatePath("/");
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
