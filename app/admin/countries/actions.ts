"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, countries } from "@/lib/db/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createCountry(formData: FormData) {
  await requireAuth();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const flagEmoji = String(formData.get("flagEmoji") ?? "").trim() || null;

  if (!code || !name) throw new Error("Kód i název jsou povinné");
  if (!/^[A-Z]{2,3}$/.test(code))
    throw new Error("Kód musí být 2-3 velká písmena (např. CZ)");

  await db.insert(countries).values({ code, name, flagEmoji });
  revalidatePath("/admin/countries");
  revalidatePath("/admin/channels");
}

export async function deleteCountry(id: number) {
  await requireAuth();
  await db.delete(countries).where(eq(countries.id, id));
  revalidatePath("/admin/countries");
  revalidatePath("/admin/channels");
}
