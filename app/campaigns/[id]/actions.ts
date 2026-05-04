"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  comments,
  shareLinks,
  auditLog,
} from "@/lib/db/client";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Cancel a campaign (kept for history; soft "delete"). */
export async function cancelCampaign(campaignId: number) {
  const userId = await requireUser();
  await db
    .update(campaigns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await db.insert(auditLog).values({
    action: "cancelled",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: null,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}

/** Inline-rename a campaign without touching anything else. */
export async function renameCampaign(campaignId: number, newName: string) {
  const userId = await requireUser();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Název nesmí být prázdný");
  if (trimmed.length > 200) throw new Error("Název je příliš dlouhý");

  const [existing] = await db
    .select({ name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  await db
    .update(campaigns)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: { renamed: { from: existing?.name ?? null, to: trimmed } },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
  revalidatePath("/campaigns");
}

/** Un-cancel: cancelled → approved. */
export async function reactivateCampaign(campaignId: number) {
  const userId = await requireUser();
  await db
    .update(campaigns)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: { reactivated: true, status: "approved" },
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addComment(campaignId: number, formData: FormData) {
  const userId = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  if (body.length > 2000) throw new Error("Komentář je příliš dlouhý");

  await db.insert(comments).values({ campaignId, userId, body });
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function deleteComment(commentId: number) {
  const userId = await requireUser();
  // Only allow deleting own comments. (Tightening: admins could override; for
  // now keep it simple — small trusted team.)
  const [c] = await db
    .select({ id: comments.id, userId: comments.userId, campaignId: comments.campaignId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!c) return;
  if (c.userId !== userId) throw new Error("Nemůžeš mazat cizí komentáře");

  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath(`/campaigns/${c.campaignId}`);
}

// ---------------------------------------------------------------------------
// Share links
// ---------------------------------------------------------------------------

const DEFAULT_SHARE_EXPIRY_DAYS = 30;

/**
 * Create a public read-only link for a campaign. Returns the absolute URL.
 * No login required to view; expires after `expiresInDays` (default 30).
 */
export async function createCampaignShareLink(
  campaignId: number,
  expiresInDays: number = DEFAULT_SHARE_EXPIRY_DAYS
): Promise<string> {
  const userId = await requireUser();

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.insert(shareLinks).values({
    token,
    payload: { type: "campaign", campaignId },
    expiresAt,
    createdById: userId,
  });

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}/share/${token}`;
}

/**
 * Create a public read-only link to the WHOLE timeline at the current filter
 * + date-range state. Used by the dashboard's "Sdílet timeline" button — the
 * client passes whatever URL params it currently has (?from=&to=&country=&...).
 *
 * The payload is a frozen snapshot. Activity inside the date range stays
 * visible to the client even as new campaigns are added later.
 */
export async function createTimelineShareLink(
  filters: Record<string, string>,
  expiresInDays: number = DEFAULT_SHARE_EXPIRY_DAYS
): Promise<string> {
  const userId = await requireUser();

  // Whitelist params we recognize — drop anything else so a malicious caller
  // can't stuff arbitrary keys into the JSONB payload.
  const ALLOWED = [
    "from",
    "to",
    "q",
    "country",
    "chain",
    "client",
    "status",
    "runState",
    "tag",
  ] as const;
  const safe: Record<string, string> = {};
  for (const k of ALLOWED) {
    const v = filters[k];
    if (typeof v === "string" && v.trim()) safe[k] = v;
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.insert(shareLinks).values({
    token,
    payload: { type: "timeline", filters: safe },
    expiresAt,
    createdById: userId,
  });

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}/share/${token}`;
}

/**
 * Move a campaign's bar from one channel to another (drag-vertically-onto-row).
 *
 * If the campaign is already on the target channel, this collapses to "remove
 * from old". Otherwise it's a swap: delete the old (campaignId, oldChannelId)
 * row, insert (campaignId, newChannelId).
 */
export async function moveCampaignToChannel(
  campaignId: number,
  oldChannelId: number,
  newChannelId: number
) {
  const userId = await requireUser();
  if (oldChannelId === newChannelId) return;

  const alreadyOnTarget = await db
    .select({ campaignId: campaignChannels.campaignId })
    .from(campaignChannels)
    .where(
      and(
        eq(campaignChannels.campaignId, campaignId),
        eq(campaignChannels.channelId, newChannelId)
      )
    )
    .limit(1);

  await db
    .delete(campaignChannels)
    .where(
      and(
        eq(campaignChannels.campaignId, campaignId),
        eq(campaignChannels.channelId, oldChannelId)
      )
    );

  if (alreadyOnTarget.length === 0) {
    await db
      .insert(campaignChannels)
      .values({ campaignId, channelId: newChannelId });
  }

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: {
      via: "timeline-drag-channel",
      from: oldChannelId,
      to: newChannelId,
    },
  });

  revalidatePath("/");
  revalidatePath(`/campaigns/${campaignId}`);
}

/**
 * Drag-driven update of a campaign's date range. Called from the timeline when
 * the user releases a drag/resize. Server-side validation guards against bad
 * input regardless of what the client sends.
 */
export async function moveCampaign(
  campaignId: number,
  startsAt: Date,
  endsAt: Date
) {
  const userId = await requireUser();

  // Coerce — the action receives Date but client serialization may turn it
  // into an ISO string in some adapter setups; be defensive.
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end < start
  ) {
    throw new Error("Neplatná data");
  }

  // Capture old dates so the audit log can render a diff.
  const [before] = await db
    .select({ startsAt: campaigns.startsAt, endsAt: campaigns.endsAt })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  await db
    .update(campaigns)
    .set({
      startsAt: start,
      endsAt: end,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  const changes: Record<string, unknown> = { via: "timeline-drag" };
  if (before && before.startsAt.getTime() !== start.getTime()) {
    changes.startsAt = {
      from: before.startsAt.toISOString(),
      to: start.toISOString(),
    };
  }
  if (before && before.endsAt.getTime() !== end.getTime()) {
    changes.endsAt = {
      from: before.endsAt.toISOString(),
      to: end.toISOString(),
    };
  }

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes,
  });

  revalidatePath("/");
}

/**
 * Soft-delete: marks the campaign as archived (hidden from default views,
 * restorable from /admin/archive). Use `permanentlyDeleteCampaign` for hard
 * removal — that one is reachable only from the archive page.
 */
export async function archiveCampaign(campaignId: number) {
  const userId = await requireUser();

  await db
    .update(campaigns)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  await db.insert(auditLog).values({
    action: "archived",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: null,
  });

  revalidatePath("/");
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

/** Bring a previously archived campaign back to the active list. */
export async function unarchiveCampaign(campaignId: number) {
  const userId = await requireUser();

  await db
    .update(campaigns)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: { unarchived: true },
  });

  revalidatePath("/admin/archive");
  revalidatePath("/campaigns");
  revalidatePath("/");
}

/**
 * Hard delete (alias kept under the old name for compatibility with code that
 * already imports `deleteCampaign`). UI-wise, only /admin/archive exposes this
 * via a "Smazat trvale" button. Daily flow goes through `archiveCampaign`.
 */
export async function deleteCampaign(campaignId: number) {
  const userId = await requireUser();

  const [existing] = await db
    .select({ name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  await db.delete(campaigns).where(eq(campaigns.id, campaignId));

  await db.insert(auditLog).values({
    action: "deleted",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: existing ? { name: existing.name } : null,
  });

  revalidatePath("/");
  revalidatePath("/admin/archive");
  redirect("/admin/archive");
}

/**
 * Duplicate a campaign — same fields, same channels, name suffixed with "(kopie)".
 * Redirects to the edit page so the user can adjust dates / details immediately.
 */
export async function cloneCampaign(campaignId: number) {
  const userId = await requireUser();

  const [original] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!original) throw new Error("Kampaň neexistuje");

  const originalChannels = await db
    .select({ channelId: campaignChannels.channelId })
    .from(campaignChannels)
    .where(eq(campaignChannels.campaignId, campaignId));

  const [clone] = await db
    .insert(campaigns)
    .values({
      name: `${original.name} (kopie)`,
      client: original.client,
      videoUrl: original.videoUrl,
      productId: original.productId,
      startsAt: original.startsAt,
      endsAt: original.endsAt,
      notes: original.notes,
      createdById: userId,
    })
    .returning({ id: campaigns.id });

  if (originalChannels.length > 0) {
    await db.insert(campaignChannels).values(
      originalChannels.map((c) => ({
        campaignId: clone.id,
        channelId: c.channelId,
      }))
    );
  }

  await db.insert(auditLog).values({
    action: "created",
    entity: "campaign",
    entityId: clone.id,
    userId,
    changes: { clonedFrom: campaignId, name: original.name },
  });

  revalidatePath("/");
  redirect(`/campaigns/${clone.id}/edit`);
}

// ---------------------------------------------------------------------------
// Per-channel overrides
//
// "Datart sells out on day 7, leave the rest of the campaign running" — the
// dates / cancellation on a single (campaign × channel) row that supersede
// the master campaign for that channel only. NULL = inherit master.
// ---------------------------------------------------------------------------

type ChannelOverride = {
  /** ISO yyyy-mm-dd or null (= inherit master). */
  startsAt: string | null;
  /** ISO yyyy-mm-dd or null (= inherit master). */
  endsAt: string | null;
  /** When true, this channel is cancelled (timestamped now). When false,
   *  cancellation is cleared. */
  cancelled: boolean;
};

function parseDateOrNull(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function setChannelOverride(
  campaignId: number,
  channelId: number,
  override: ChannelOverride
) {
  const userId = await requireUser();

  const startsAt = parseDateOrNull(override.startsAt);
  const endsAt = parseDateOrNull(override.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new Error("Konec nemůže být před začátkem.");
  }

  await db
    .update(campaignChannels)
    .set({
      startsAt,
      endsAt,
      cancelledAt: override.cancelled ? new Date() : null,
    })
    .where(
      and(
        eq(campaignChannels.campaignId, campaignId),
        eq(campaignChannels.channelId, channelId)
      )
    );

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: {
      channelOverride: {
        channelId,
        startsAt: override.startsAt,
        endsAt: override.endsAt,
        cancelled: override.cancelled,
      },
    },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
  revalidatePath("/campaigns");
}

/** Wipe all per-channel overrides on this row — bar reverts to master dates
 *  and the channel becomes active (if the master campaign is itself active). */
export async function clearChannelOverride(
  campaignId: number,
  channelId: number
) {
  const userId = await requireUser();

  await db
    .update(campaignChannels)
    .set({ startsAt: null, endsAt: null, cancelledAt: null })
    .where(
      and(
        eq(campaignChannels.campaignId, campaignId),
        eq(campaignChannels.channelId, channelId)
      )
    );

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: { channelOverrideCleared: { channelId } },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
  revalidatePath("/campaigns");
}
