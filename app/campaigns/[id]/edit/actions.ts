"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  games,
  auditLog,
} from "@/lib/db/client";
import { isValidCampaignColor, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";
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
    gameName: z.string().optional(),
    gameReleaseDate: z.string().optional(),
    gameCoverUrl: z.string().optional(),
    gameSummary: z.string().optional(),
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

  const gameName = String(formData.get("gameName") ?? "").trim();
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
    gameName: gameName || undefined,
    gameReleaseDate: formData.get("gameReleaseDate") || undefined,
    gameCoverUrl: formData.get("gameCoverUrl") || undefined,
    gameSummary: formData.get("gameSummary") || undefined,
  });

  const color =
    parsed.color && isValidCampaignColor(parsed.color)
      ? parsed.color
      : DEFAULT_CAMPAIGN_COLOR;
  const status =
    parsed.status && isValidStatus(parsed.status) ? parsed.status : "approved";

  let gameId: number | null = null;
  if (parsed.gameName) {
    const existing = await db
      .select({ id: games.id })
      .from(games)
      .where(sql`lower(${games.name}) = lower(${parsed.gameName})`)
      .limit(1);

    if (existing.length > 0) {
      gameId = existing[0].id;
      await db
        .update(games)
        .set({
          coverUrl: parsed.gameCoverUrl || null,
          summary: parsed.gameSummary || null,
          releaseDate: parsed.gameReleaseDate
            ? new Date(parsed.gameReleaseDate)
            : null,
        })
        .where(eq(games.id, gameId));
    } else {
      const [inserted] = await db
        .insert(games)
        .values({
          name: parsed.gameName,
          coverUrl: parsed.gameCoverUrl || null,
          summary: parsed.gameSummary || null,
          releaseDate: parsed.gameReleaseDate
            ? new Date(parsed.gameReleaseDate)
            : null,
        })
        .returning({ id: games.id });
      gameId = inserted.id;
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
      gameId,
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
