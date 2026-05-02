"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  products,
  campaignTemplates,
} from "@/lib/db/client";
import { daysBetween } from "@/lib/utils";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type TemplatePayload = {
  client: string | null;
  videoUrl: string | null;
  color: string;
  tags: string[];
  durationDays: number;
  notes: string | null;
  channelIds: number[];
  product: {
    name: string;
    kind: string;
    releaseDate: string | null;
    coverUrl: string | null;
    summary: string | null;
  } | null;
};

/**
 * Snapshot a campaign as a reusable template.
 * Captures everything except dates (stores duration instead) so the template
 * can be applied to any future date range.
 */
export async function saveCampaignAsTemplate(
  campaignId: number,
  formData: FormData
) {
  const userId = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Pojmenuj šablonu");
  if (name.length > 80) throw new Error("Příliš dlouhý název");

  const [row] = await db
    .select({ campaign: campaigns, product: products })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) throw new Error("Kampaň nenalezena");

  const channelRows = await db
    .select({ channelId: campaignChannels.channelId })
    .from(campaignChannels)
    .where(eq(campaignChannels.campaignId, campaignId));

  const c = row.campaign;
  const payload: TemplatePayload = {
    client: c.client,
    videoUrl: c.videoUrl,
    color: c.color,
    tags: c.tags ?? [],
    durationDays: daysBetween(c.startsAt, c.endsAt),
    notes: c.notes,
    channelIds: channelRows.map((r) => r.channelId),
    product: row.product
      ? {
          name: row.product.name,
          kind: row.product.kind,
          releaseDate: row.product.releaseDate
            ? row.product.releaseDate.toISOString()
            : null,
          coverUrl: row.product.coverUrl,
          summary: row.product.summary,
        }
      : null,
  };

  await db.insert(campaignTemplates).values({
    name,
    payload,
    createdById: userId,
  });

  revalidatePath("/admin/templates");
}

export async function deleteTemplate(templateId: number) {
  await requireUser();
  await db
    .delete(campaignTemplates)
    .where(eq(campaignTemplates.id, templateId));
  revalidatePath("/admin/templates");
}
