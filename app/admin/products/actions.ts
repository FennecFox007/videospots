"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, products } from "@/lib/db/client";
import { isValidKind, DEFAULT_PRODUCT_KIND } from "@/lib/products";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function createProduct(formData: FormData) {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Název je povinný");

  const kindRaw = String(formData.get("kind") ?? "").trim();
  const kind = isValidKind(kindRaw) ? kindRaw : DEFAULT_PRODUCT_KIND;

  const releaseDate = parseDateOrNull(
    String(formData.get("releaseDate") ?? "").trim() || null
  );
  const coverUrl = String(formData.get("coverUrl") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;

  await db.insert(products).values({
    name,
    kind,
    releaseDate,
    coverUrl,
    summary,
  });

  revalidatePath("/admin/products");
  revalidatePath("/releases");
}

export async function updateProduct(productId: number, formData: FormData) {
  await requireAuth();

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

  revalidatePath("/admin/products");
  revalidatePath("/releases");
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProduct(productId: number) {
  await requireAuth();
  // Campaigns referencing this product have ON DELETE SET NULL, so we don't
  // orphan them — they just lose the product link.
  await db.delete(products).where(eq(products.id, productId));
  revalidatePath("/admin/products");
  revalidatePath("/releases");
}
