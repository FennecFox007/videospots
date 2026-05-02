"use server";

// Bulk operations on multiple campaigns at once. Triggered from the table
// footer on /campaigns (active list) or /admin/archive (archived list).

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, campaigns, auditLog } from "@/lib/db/client";
import { isValidCampaignColor, DEFAULT_CAMPAIGN_COLOR } from "@/lib/colors";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function normalizeIds(ids: number[]): number[] {
  const out = ids
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(out));
}

/**
 * Soft-delete a batch of campaigns (sets archived_at = now). Default bulk
 * action on /campaigns.
 */
export async function bulkArchiveCampaigns(ids: number[]) {
  const userId = await requireUser();
  const list = normalizeIds(ids);
  if (list.length === 0) return;

  await db
    .update(campaigns)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(inArray(campaigns.id, list));

  await db.insert(auditLog).values(
    list.map((id) => ({
      action: "archived",
      entity: "campaign",
      entityId: id,
      userId,
      changes: { bulk: true } as Record<string, unknown>,
    }))
  );

  revalidatePath("/campaigns");
  revalidatePath("/admin/archive");
  revalidatePath("/");
}

/** Restore archived campaigns. Bulk equivalent of unarchiveCampaign. */
export async function bulkUnarchiveCampaigns(ids: number[]) {
  const userId = await requireUser();
  const list = normalizeIds(ids);
  if (list.length === 0) return;

  await db
    .update(campaigns)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(inArray(campaigns.id, list));

  await db.insert(auditLog).values(
    list.map((id) => ({
      action: "updated",
      entity: "campaign",
      entityId: id,
      userId,
      changes: { unarchived: true, bulk: true } as Record<string, unknown>,
    }))
  );

  revalidatePath("/campaigns");
  revalidatePath("/admin/archive");
  revalidatePath("/");
}

/**
 * Hard-delete a batch of campaigns. Reachable only from /admin/archive
 * (after they've been archived) — UI label is "Smazat trvale".
 */
export async function bulkDeleteCampaigns(ids: number[]) {
  const userId = await requireUser();
  const list = normalizeIds(ids);
  if (list.length === 0) return;

  // Capture names for the audit log before deletion.
  const existing = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(inArray(campaigns.id, list));

  await db.delete(campaigns).where(inArray(campaigns.id, list));

  if (existing.length > 0) {
    await db.insert(auditLog).values(
      existing.map((c) => ({
        action: "deleted",
        entity: "campaign",
        entityId: c.id,
        userId,
        changes: { name: c.name, bulk: true } as Record<string, unknown>,
      }))
    );
  }

  revalidatePath("/campaigns");
  revalidatePath("/admin/archive");
  revalidatePath("/");
}

export async function bulkCancelCampaigns(ids: number[]) {
  const userId = await requireUser();
  const list = normalizeIds(ids);
  if (list.length === 0) return;

  await db
    .update(campaigns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(inArray(campaigns.id, list));

  await db.insert(auditLog).values(
    list.map((id) => ({
      action: "cancelled",
      entity: "campaign",
      entityId: id,
      userId,
      changes: { bulk: true } as Record<string, unknown>,
    }))
  );

  revalidatePath("/campaigns");
  revalidatePath("/");
}

export async function bulkChangeColor(ids: number[], color: string) {
  const userId = await requireUser();
  const list = normalizeIds(ids);
  if (list.length === 0) return;

  const safeColor = isValidCampaignColor(color)
    ? color
    : DEFAULT_CAMPAIGN_COLOR;

  await db
    .update(campaigns)
    .set({ color: safeColor, updatedAt: new Date() })
    .where(inArray(campaigns.id, list));

  await db.insert(auditLog).values(
    list.map((id) => ({
      action: "updated",
      entity: "campaign",
      entityId: id,
      userId,
      changes: { color: safeColor, bulk: true } as Record<string, unknown>,
    }))
  );

  revalidatePath("/campaigns");
  revalidatePath("/");
}
