"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";
import { db, channels, chains, auditLog } from "@/lib/db/client";

/**
 * Toggle a channel: if it exists for this (country, chain), delete it; else create it.
 * Drives the matrix UI on /admin/channels.
 */
export async function toggleChannel(countryId: number, chainId: number) {
  const userId = await requireAdmin();

  const existing = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.countryId, countryId), eq(channels.chainId, chainId)))
    .limit(1);

  if (existing.length > 0) {
    const channelId = existing[0].id;
    await db.delete(channels).where(eq(channels.id, channelId));
    await db.insert(auditLog).values({
      action: "deleted",
      entity: "channel",
      entityId: channelId,
      userId,
      changes: { countryId, chainId },
    });
  } else {
    const [created] = await db
      .insert(channels)
      .values({ countryId, chainId })
      .returning({ id: channels.id });
    await db.insert(auditLog).values({
      action: "created",
      entity: "channel",
      entityId: created.id,
      userId,
      changes: { countryId, chainId },
    });
  }

  revalidatePath("/admin/channels");
  revalidatePath("/");
}

/**
 * One-shot "add a chain to a country": creates the chain (or reuses if a chain
 * with the slugified code already exists) and ensures the (country, chain)
 * channel exists. Used by the inline form on /admin/channels.
 */
export async function addChainToCountry(
  countryId: number,
  formData: FormData
) {
  const userId = await requireAdmin();

  const rawName = String(formData.get("chainName") ?? "").trim();
  if (!rawName) return; // empty submit — silently noop
  const code = slugify(rawName);
  if (!code) throw new Error("Neplatný název řetězce");

  // Find or create chain by code.
  let chainId: number;
  const existingChain = await db
    .select({ id: chains.id })
    .from(chains)
    .where(eq(chains.code, code))
    .limit(1);

  if (existingChain.length > 0) {
    chainId = existingChain[0].id;
  } else {
    const [inserted] = await db
      .insert(chains)
      .values({ code, name: rawName, sortOrder: 99 })
      .returning({ id: chains.id });
    chainId = inserted.id;
    await db.insert(auditLog).values({
      action: "created",
      entity: "chain",
      entityId: chainId,
      userId,
      changes: { code, name: rawName, via: "addChainToCountry" },
    });
  }

  // Ensure the channel exists.
  const existingChannel = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.countryId, countryId), eq(channels.chainId, chainId)))
    .limit(1);

  if (existingChannel.length === 0) {
    const [created] = await db
      .insert(channels)
      .values({ countryId, chainId })
      .returning({ id: channels.id });
    await db.insert(auditLog).values({
      action: "created",
      entity: "channel",
      entityId: created.id,
      userId,
      changes: { countryId, chainId, via: "addChainToCountry" },
    });
  }

  revalidatePath("/admin/channels");
  revalidatePath("/admin/chains");
  revalidatePath("/");
}

/** Lowercase, ASCII-only slug. Strips Czech/Slovak diacritics. */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
