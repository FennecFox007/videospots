"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";
import { db, products, auditLog } from "@/lib/db/client";
import { isValidKind, DEFAULT_PRODUCT_KIND } from "@/lib/products";

function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function createProduct(formData: FormData) {
  const userId = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Název je povinný");

  const kindRaw = String(formData.get("kind") ?? "").trim();
  const kind = isValidKind(kindRaw) ? kindRaw : DEFAULT_PRODUCT_KIND;

  const releaseDate = parseDateOrNull(
    String(formData.get("releaseDate") ?? "").trim() || null
  );
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;

  const [created] = await db
    .insert(products)
    .values({
      name,
      kind,
      releaseDate,
      coverUrl,
      summary,
    })
    .returning({ id: products.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "product",
    entityId: created.id,
    userId,
    changes: { name, kind },
  });

  revalidatePath("/admin/products");
  revalidatePath("/releases");
}

export async function updateProduct(productId: number, formData: FormData) {
  const userId = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Název je povinný");

  const kindRaw = String(formData.get("kind") ?? "").trim();
  const kind = isValidKind(kindRaw) ? kindRaw : DEFAULT_PRODUCT_KIND;

  const releaseDate = parseDateOrNull(
    String(formData.get("releaseDate") ?? "").trim() || null
  );
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;

  await db
    .update(products)
    .set({ name, kind, releaseDate, coverUrl, summary })
    .where(eq(products.id, productId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "product",
    entityId: productId,
    userId,
    changes: { name, kind },
  });

  revalidatePath("/admin/products");
  revalidatePath("/releases");
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProduct(productId: number) {
  const userId = await requireAdmin();

  // Snapshot before delete so the audit trail survives the row.
  const [target] = await db
    .select({ name: products.name, kind: products.kind })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  // Campaigns referencing this product have ON DELETE SET NULL, so we don't
  // orphan them — they just lose the product link.
  await db.delete(products).where(eq(products.id, productId));

  await db.insert(auditLog).values({
    action: "deleted",
    entity: "product",
    entityId: productId,
    userId,
    changes: { name: target?.name ?? null, kind: target?.kind ?? null },
  });

  revalidatePath("/admin/products");
  revalidatePath("/releases");
  // Timeline + list both display the product name on each campaign card,
  // so a deleted product needs to flush those too.
  revalidatePath("/");
  revalidatePath("/campaigns");
}
