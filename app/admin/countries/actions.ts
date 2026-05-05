"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, countries, auditLog } from "@/lib/db/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createCountry(formData: FormData) {
  const userId = await requireAuth();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const flagEmoji = String(formData.get("flagEmoji") ?? "").trim() || null;

  if (!code || !name) throw new Error("Kód i název jsou povinné");
  if (!/^[A-Z]{2,3}$/.test(code))
    throw new Error("Kód musí být 2-3 velká písmena (např. CZ)");

  const [created] = await db
    .insert(countries)
    .values({ code, name, flagEmoji })
    .returning({ id: countries.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "country",
    entityId: created.id,
    userId,
    changes: { code, name, flagEmoji },
  });

  revalidatePath("/admin/countries");
  revalidatePath("/admin/channels");
}

export async function deleteCountry(id: number) {
  const userId = await requireAuth();

  // Snapshot the row before deletion so the audit entry survives the row.
  // (FK is restrict, so this only succeeds when no channels reference it.)
  const [target] = await db
    .select({ code: countries.code, name: countries.name })
    .from(countries)
    .where(eq(countries.id, id))
    .limit(1);

  await db.delete(countries).where(eq(countries.id, id));

  await db.insert(auditLog).values({
    action: "deleted",
    entity: "country",
    entityId: id,
    userId,
    changes: { code: target?.code ?? null, name: target?.name ?? null },
  });

  revalidatePath("/admin/countries");
  revalidatePath("/admin/channels");
}
