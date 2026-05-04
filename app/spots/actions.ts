"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  spots,
  products,
  campaignVideos,
  auditLog,
} from "@/lib/db/client";
import { isValidKind, DEFAULT_PRODUCT_KIND } from "@/lib/products";

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
