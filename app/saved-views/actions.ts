"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, savedViews } from "@/lib/db/client";

// Whitelist of URL params we'll persist in a saved view. Other keys (like
// `template`, `sort`, `order` from the campaigns list) are intentionally NOT
// included — sort order especially is a per-session preference, not a saved
// filter intent.
const ALLOWED_PARAMS = [
  "q",
  "country",
  "chain",
  "client",
  "status",
  "runState",
  "tag",
  "communicationType",
  "from",
  "to",
] as const;

type Scope = "timeline" | "campaigns";

function isScope(s: string): s is Scope {
  return s === "timeline" || s === "campaigns";
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/**
 * Persist the current URL filter state under a user-supplied name.
 *
 * Called from the client when the user clicks "Uložit pohled" in the FilterBar.
 * `payloadEntries` is whatever the client read out of `useSearchParams()` —
 * we re-validate against the whitelist server-side so a malicious caller
 * can't stuff arbitrary keys into the JSONB column.
 */
export async function createSavedView(
  name: string,
  scope: string,
  payloadEntries: Record<string, string>
) {
  const userId = await requireUser();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Název pohledu je povinný");
  if (trimmedName.length > 80) throw new Error("Název je příliš dlouhý");
  if (!isScope(scope)) throw new Error("Neplatný scope pohledu");

  const safe: Record<string, string> = {};
  for (const k of ALLOWED_PARAMS) {
    const v = payloadEntries[k];
    if (typeof v === "string" && v.trim()) safe[k] = v;
  }

  await db.insert(savedViews).values({
    userId,
    name: trimmedName,
    scope,
    payload: safe,
  });

  // Both pages render saved-view dropdowns; revalidate them broadly.
  revalidatePath("/");
  revalidatePath("/campaigns");
}

/** Delete a saved view. Only the owner can delete it. */
export async function deleteSavedView(viewId: number) {
  const userId = await requireUser();
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.userId, userId)));
  revalidatePath("/");
  revalidatePath("/campaigns");
}

/** Per-user list of saved views in a given scope. Used by the FilterBar. */
export async function listSavedViews(scope: Scope): Promise<
  { id: number; name: string; payload: Record<string, string> }[]
> {
  const userId = await requireUser();
  const rows = await db
    .select({
      id: savedViews.id,
      name: savedViews.name,
      payload: savedViews.payload,
    })
    .from(savedViews)
    .where(and(eq(savedViews.userId, userId), eq(savedViews.scope, scope)))
    .orderBy(asc(savedViews.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    payload: (r.payload as Record<string, string>) ?? {},
  }));
}
