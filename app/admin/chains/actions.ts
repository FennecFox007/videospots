"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, chains, auditLog } from "@/lib/db/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createChain(formData: FormData) {
  const userId = await requireAuth();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

  if (!code || !name) throw new Error("Kód i název jsou povinné");
  if (!/^[a-z0-9-]+$/.test(code))
    throw new Error("Kód: jen malá písmena, čísla a pomlčky");

  const [created] = await db
    .insert(chains)
    .values({ code, name, logoUrl })
    .returning({ id: chains.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "chain",
    entityId: created.id,
    userId,
    changes: { code, name, logoUrl },
  });

  revalidatePath("/admin/chains");
  revalidatePath("/admin/channels");
}

export async function deleteChain(id: number) {
  const userId = await requireAuth();

  const [target] = await db
    .select({ code: chains.code, name: chains.name })
    .from(chains)
    .where(eq(chains.id, id))
    .limit(1);

  await db.delete(chains).where(eq(chains.id, id));

  await db.insert(auditLog).values({
    action: "deleted",
    entity: "chain",
    entityId: id,
    userId,
    changes: { code: target?.code ?? null, name: target?.name ?? null },
  });

  revalidatePath("/admin/chains");
  revalidatePath("/admin/channels");
}

/**
 * Reorder chains by swapping sortOrder with the immediate neighbor.
 * Direction: -1 = move up (toward lower sortOrder), 1 = move down.
 *
 * Why swap instead of recompute the whole list? Cheaper, and the user only
 * ever moves one row at a time. Edge cases (gaps, ties): the asc-by-sortOrder
 * lookup of the neighbor handles them — even if two chains share a sortOrder,
 * we just swap with whichever lookup returns first.
 */
export async function reorderChain(id: number, direction: -1 | 1) {
  await requireAuth();

  const all = await db
    .select({ id: chains.id, sortOrder: chains.sortOrder, name: chains.name })
    .from(chains)
    .orderBy(asc(chains.sortOrder), asc(chains.name));

  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const neighborIdx = direction === -1 ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= all.length) return;

  const a = all[idx];
  const b = all[neighborIdx];

  // If they happen to share a sortOrder, give them distinct values first.
  const aOrder = a.sortOrder;
  const bOrder = b.sortOrder === a.sortOrder ? a.sortOrder + 1 : b.sortOrder;

  await db
    .update(chains)
    .set({ sortOrder: bOrder })
    .where(eq(chains.id, a.id));
  await db
    .update(chains)
    .set({ sortOrder: aOrder })
    .where(eq(chains.id, b.id));

  revalidatePath("/admin/chains");
  revalidatePath("/admin/channels");
  revalidatePath("/");
}
