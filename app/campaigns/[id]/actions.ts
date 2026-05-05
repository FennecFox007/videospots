"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  comments,
  shareLinks,
  auditLog,
} from "@/lib/db/client";
import { requireEditor as requireUser } from "@/lib/auth-helpers";

// All campaign mutations are editor+. The local `requireUser` alias is kept
// so existing call sites read the same; semantics are now "must be editor
// or admin", which excludes the read-only viewer role.

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
  // /campaigns table shows status badges — without this, cancelling from
  // peek/timeline left the list view stale until something else triggered
  // a refresh.
  revalidatePath("/campaigns");
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
  revalidatePath("/campaigns");
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
// Allowed expiry presets exposed in the create UI. Hard-coded list (not
// arbitrary user-supplied number) so a) the chip is always one-of-N and
// b) we can't accidentally accept absurd values like "1000 days" through
// a URL crafted by a leaker. "Bez expirace" is intentionally NOT here:
// every public link ought to have a natural sunset given the NDA-laden
// content on /share. Editors can extend an active link instead.
const ALLOWED_SHARE_EXPIRY_DAYS = [7, 30, 90] as const;
type AllowedExpiryDays = (typeof ALLOWED_SHARE_EXPIRY_DAYS)[number];

function normaliseExpiryDays(input: number | undefined): AllowedExpiryDays {
  // Accept the type at compile time; defend at runtime so we can't poison
  // the DB if a stale client sends something exotic. Falls back to 30.
  return (
    (ALLOWED_SHARE_EXPIRY_DAYS as readonly number[]).includes(input ?? -1)
      ? (input as AllowedExpiryDays)
      : DEFAULT_SHARE_EXPIRY_DAYS
  ) as AllowedExpiryDays;
}

function normaliseLabel(input: string | null | undefined): string | null {
  // Trim + length-cap. Empty string becomes null (cleaner DB rows + simpler
  // "show label only if set" rendering).
  if (!input) return null;
  const trimmed = input.trim().slice(0, 80);
  return trimmed.length > 0 ? trimmed : null;
}

async function buildShareUrl(token: string): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}/share/${token}`;
}

/**
 * Create a public read-only link for a campaign. Returns the absolute URL.
 * No login required to view; expires after `expiresInDays` (default 30).
 *
 * Multiple links can coexist on the same campaign — re-clicking "Sdílet"
 * generates a new token rather than reusing an existing one. That way an
 * editor can hand different links to different recipients (with different
 * expirations / labels) and revoke one without nuking the others.
 */
export async function createCampaignShareLink(
  campaignId: number,
  options?: { expiresInDays?: number; label?: string | null }
): Promise<string> {
  const userId = await requireUser();

  const days = normaliseExpiryDays(options?.expiresInDays);
  const label = normaliseLabel(options?.label);

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const [created] = await db
    .insert(shareLinks)
    .values({
      token,
      payload: { type: "campaign", campaignId },
      label,
      expiresAt,
      createdById: userId,
    })
    .returning({ id: shareLinks.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "shareLink",
    entityId: created.id,
    userId,
    changes: { campaignId, expiresInDays: days, label, type: "campaign" },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/admin/share-links");
  return await buildShareUrl(token);
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
  options?: { expiresInDays?: number; label?: string | null }
): Promise<string> {
  const userId = await requireUser();

  // Whitelist params we recognize — drop anything else so a malicious caller
  // can't stuff arbitrary keys into the JSONB payload. Must mirror the live
  // FilterBar; earlier this listed `client` (filter removed) and missed
  // `approval` + `missingSpot` (so share links of "Čeká na schválení" views
  // silently shipped everything).
  const ALLOWED = [
    "from",
    "to",
    "q",
    "country",
    "chain",
    "status",
    "runState",
    "approval",
    "missingSpot",
    "tag",
  ] as const;
  const safe: Record<string, string> = {};
  for (const k of ALLOWED) {
    const v = filters[k];
    if (typeof v === "string" && v.trim()) safe[k] = v;
  }

  const days = normaliseExpiryDays(options?.expiresInDays);
  const label = normaliseLabel(options?.label);

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const [created] = await db
    .insert(shareLinks)
    .values({
      token,
      payload: { type: "timeline", filters: safe },
      label,
      expiresAt,
      createdById: userId,
    })
    .returning({ id: shareLinks.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "shareLink",
    entityId: created.id,
    userId,
    changes: {
      type: "timeline",
      expiresInDays: days,
      label,
      filters: safe,
    },
  });

  revalidatePath("/admin/share-links");
  return await buildShareUrl(token);
}

/**
 * Soft-revoke a share link: marks `revokedAt` so /share/[token] starts
 * returning 404 immediately. The row stays in the DB for audit history
 * (so we can answer "kdo komu poslal odkaz na 'Saros launch'?" months
 * later). Different from natural expiry — that's just the timestamp
 * passing; this is an editor's explicit intent.
 *
 * Idempotent: revoking an already-revoked link is a no-op (no second
 * audit entry, no error). Saves us a confirm() round-trip in the UI
 * if someone double-clicks.
 */
export async function revokeShareLink(linkId: number): Promise<void> {
  const userId = await requireUser();

  const [existing] = await db
    .select({
      id: shareLinks.id,
      payload: shareLinks.payload,
      revokedAt: shareLinks.revokedAt,
      label: shareLinks.label,
    })
    .from(shareLinks)
    .where(eq(shareLinks.id, linkId))
    .limit(1);
  if (!existing) throw new Error("Share link not found");
  if (existing.revokedAt) return; // already revoked

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date(), revokedById: userId })
    .where(eq(shareLinks.id, linkId));

  // Surface enough context in the audit log that you can answer
  // "kdo deaktivoval odkaz na kampaň X" without a JOIN to share_link
  // (which might itself get GC'd in some future cleanup).
  const payload = existing.payload as
    | { type: "campaign"; campaignId: number }
    | { type: "timeline"; filters: Record<string, string> };
  await db.insert(auditLog).values({
    action: "revoked",
    entity: "shareLink",
    entityId: linkId,
    userId,
    changes: {
      type: payload.type,
      label: existing.label,
      ...(payload.type === "campaign"
        ? { campaignId: payload.campaignId }
        : {}),
    },
  });

  // Re-render anywhere the link list might appear.
  if (payload.type === "campaign") {
    revalidatePath(`/campaigns/${payload.campaignId}`);
  }
  revalidatePath("/admin/share-links");
}

/**
 * Push a share link's natural expiry forward by `days`. If the link is
 * already revoked, this is a no-op + throws (an editor probably meant
 * to recreate, not "un-revoke" — that would feel surprising). Capped at
 * `now + 90 days` to match the create UI's longest preset; otherwise an
 * editor could quietly grow a 30-day link into a forever link via the
 * extend button.
 */
export async function extendShareLink(
  linkId: number,
  days: number
): Promise<void> {
  const userId = await requireUser();

  if (!ALLOWED_SHARE_EXPIRY_DAYS.includes(days as AllowedExpiryDays)) {
    throw new Error("Invalid extension period");
  }

  const [existing] = await db
    .select({
      id: shareLinks.id,
      payload: shareLinks.payload,
      revokedAt: shareLinks.revokedAt,
      expiresAt: shareLinks.expiresAt,
    })
    .from(shareLinks)
    .where(eq(shareLinks.id, linkId))
    .limit(1);
  if (!existing) throw new Error("Share link not found");
  if (existing.revokedAt) {
    throw new Error("Cannot extend a revoked link — create a new one");
  }

  // Extend FROM the larger of (current expiry, now). If a link expired
  // yesterday and we extend by 7 days, the new expiry is 7 days from
  // today, not 7 days from when it was supposed to die. Otherwise an
  // editor extending a long-dead link would have a paradoxically dead-
  // on-arrival "extended" link.
  const now = new Date();
  const base =
    existing.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
  const newExpiresAt = new Date(base);
  newExpiresAt.setDate(newExpiresAt.getDate() + days);

  await db
    .update(shareLinks)
    .set({ expiresAt: newExpiresAt })
    .where(eq(shareLinks.id, linkId));

  await db.insert(auditLog).values({
    action: "extended",
    entity: "shareLink",
    entityId: linkId,
    userId,
    changes: {
      previousExpiresAt: existing.expiresAt?.toISOString() ?? null,
      newExpiresAt: newExpiresAt.toISOString(),
      days,
    },
  });

  const payload = existing.payload as
    | { type: "campaign"; campaignId: number }
    | { type: "timeline" };
  if (payload.type === "campaign") {
    revalidatePath(`/campaigns/${payload.campaignId}`);
  }
  revalidatePath("/admin/share-links");
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

// ---------------------------------------------------------------------------
// Approval (auth-gated)
//
// Clicking "Schvaluji" anywhere — bar context menu, peek panel footer, or
// detail page header — calls approveCampaign. Share-view recipients can
// see the approved badge but can't approve themselves; that's why this
// action requires a logged-in user.
//
// Idempotent on second call: if already approved, we silently return so
// double-clicks don't bump the timestamp forward and overwrite the
// approver. clearCampaignApproval is the explicit way to undo.
// ---------------------------------------------------------------------------

export async function approveCampaign(
  campaignId: number,
  note: string | null = null
) {
  const userId = await requireUser();

  const [existing] = await db
    .select({ approvedAt: campaigns.clientApprovedAt })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (existing?.approvedAt) return;

  const trimmedNote = note?.trim() || null;
  const now = new Date();
  await db
    .update(campaigns)
    .set({
      clientApprovedAt: now,
      clientApprovedComment: trimmedNote,
      approvedById: userId,
      updatedAt: now,
    })
    .where(eq(campaigns.id, campaignId));

  await db.insert(auditLog).values({
    action: "approved",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: { note: trimmedNote },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function clearCampaignApproval(campaignId: number) {
  const userId = await requireUser();

  await db
    .update(campaigns)
    .set({
      clientApprovedAt: null,
      clientApprovedComment: null,
      approvedById: null,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "campaign",
    entityId: campaignId,
    userId,
    changes: { approvalCleared: true },
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
