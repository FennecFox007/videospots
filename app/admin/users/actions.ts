"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db, users } from "@/lib/db/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export async function createUser(formData: FormData) {
  await requireAuth();

  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");

  if (!email) throw new Error("E-mail / username je povinný");
  if (password.length < 4) throw new Error("Heslo musí mít aspoň 4 znaky");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) throw new Error("Uživatel s tímto e-mailem už existuje");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, name, passwordHash });

  revalidatePath("/admin/users");
}

export async function updatePassword(userId: string, formData: FormData) {
  await requireAuth();

  const password = String(formData.get("password") ?? "");
  if (password.length < 4) throw new Error("Heslo musí mít aspoň 4 znaky");

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const currentUserId = await requireAuth();
  if (userId === currentUserId) {
    throw new Error("Nemůžeš smazat sám sebe");
  }
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}
