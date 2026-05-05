"use server";

// User CRUD for /admin/users. All three actions write audit-log entries
// because user creation / password reset / deletion are the most security-
// sensitive operations in the app — without an audit trail there's no way
// to investigate "who reset whose password" if something goes wrong.
//
// `entityId` for the audit log is a UUID string in user rows; the auditLog
// schema declares `entityId: integer`, so we hash the UUID into the
// identity-id column would lose information. Instead we use entityId=0 and
// stash the actual user id under `changes.userId` (and the email so a
// post-mortem doesn't have to cross-reference the users table for a row
// that might already be deleted).

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db, users, auditLog } from "@/lib/db/client";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export async function createUser(formData: FormData) {
  const actorId = await requireAuth();

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
  const [created] = await db
    .insert(users)
    .values({ email, name, passwordHash })
    .returning({ id: users.id });

  await db.insert(auditLog).values({
    action: "created",
    entity: "user",
    entityId: 0,
    userId: actorId,
    changes: { userId: created.id, email, name },
  });

  revalidatePath("/admin/users");
}

export async function updatePassword(userId: string, formData: FormData) {
  const actorId = await requireAuth();

  const password = String(formData.get("password") ?? "");
  if (password.length < 4) throw new Error("Heslo musí mít aspoň 4 znaky");

  // Pull the email so the audit entry remains useful even if the user is
  // later deleted — without it a "reset password for #abc-123" row tells
  // you nothing post-deletion.
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  await db.insert(auditLog).values({
    action: "updated",
    entity: "user",
    entityId: 0,
    userId: actorId,
    changes: {
      userId,
      email: target?.email ?? null,
      passwordReset: true,
    },
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const actorId = await requireAuth();
  if (userId === actorId) {
    throw new Error("Nemůžeš smazat sám sebe");
  }

  const [target] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db.delete(users).where(eq(users.id, userId));

  await db.insert(auditLog).values({
    action: "deleted",
    entity: "user",
    entityId: 0,
    userId: actorId,
    changes: {
      userId,
      email: target?.email ?? null,
      name: target?.name ?? null,
    },
  });

  revalidatePath("/admin/users");
}
