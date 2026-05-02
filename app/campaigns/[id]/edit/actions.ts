"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  products,
  auditLog,
} from "@/lib/db/client";
import { isValidCampaignColor, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
import {
  isValidKind,
  DEFAULT_PRODUCT_KIND,
} from "@/lib/products";
import { isValidStatus, parseTags } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().min(1, "Název kampaně je povinný"),
    client: z.string().optional().nullable(),
    videoUrl: z.string().optional().nullable(),
    color: z.string().optional(),
    status: z.string().optional(),
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

  const parsed = schema.parse({
    name: formData.get("name"),
    client: formData.get("client") || undefined,
    videoUrl: formData.get("videoUrl") || undefined,
    color: colorRaw || undefined,
    status: statusRaw || undefined,
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
      videoUrl: parsed.videoUrl || null,
      color,
      status,
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

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId: session.user.id,
    changes: {
      name: parsed.name,
      status,
      channelCount: parsed.channelIds.length,
    },
  });

  redirect(`/campaigns/${campaignId}`);
}
