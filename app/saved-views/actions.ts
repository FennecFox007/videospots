"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db, savedViews } from "@/lib/db/client";
import { requireUser } from "@/lib/auth-helpers";

// Whitelist of URL params we'll persist in a saved view, keyed by scope.
// The page each scope renders has its own filter shape, so each gets its
// own list — saving a "spots" view shouldn't accept campaign-only keys
// like `runState` (and vice versa).
//
// Sort order (`sort`/`order`) is intentionally NOT stored — it's a per-
// session preference, not part of "this filter intent". Same for the
// /spots `group=country` toggle, which is layout, not filter.
const ALLOWED_BY_SCOPE = {
  timeline: [
    "q",
    "country",
    "chain",
    "runState",
    "approval",
    "missingSpot",
    "tag",
    "from",
    "to",
  ],
  campaigns: [
    "q",
    "country",
    "chain",
    "status",
    "runState",
    "approval",
    "missingSpot",
    "tag",
    "from",
    "to",
  ],
  // /spots is the video library. Filterable by free-text, country,
  // product, approval, and (Phase 1 of project-organization milestone)
  // by which campaign uses the creative. `view` (tab — undeployed/all/
  // archived) is included because saved views are how users effectively
  // get "project folders" — pinning a tab AND a filter together gives
  // them the equivalent.
  spots: ["q", "country", "product", "approval", "view", "campaign"],
} as const;

type Scope = keyof typeof ALLOWED_BY_SCOPE;

function isScope(s: string): s is Scope {
  return s in ALLOWED_BY_SCOPE;
}

// Saved views are personal bookmarks. Any signed-in user may save / load /
// delete their own — viewers included, since the data is strictly per-user.

/**
 * Persist the current URL filter state under a user-supplied name.
 *
 * Called from the client when the user clicks "Uložit pohled" in the FilterBar.
 * `payloadEntries` is whatever the client read out of `useSearchParams()` —
 * we re-validate against the scope-specific whitelist server-side so a
 * malicious caller can't stuff arbitrary keys into the JSONB column.
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

  const allowed: readonly string[] = ALLOWED_BY_SCOPE[scope];
  const safe: Record<string, string> = {};
  for (const k of allowed) {
    const v = payloadEntries[k];
    if (typeof v === "string" && v.trim()) safe[k] = v;
  }

  await db.insert(savedViews).values({
    userId,
    name: trimmedName,
    scope,
    payload: safe,
  });

  // Three pages render saved-view dropdowns; revalidate them all so the
  // freshly-saved view shows up in the menu without a hard reload.
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath("/spots");
}

/** Delete a saved view. Only the owner can delete it. */
export async function deleteSavedView(viewId: number) {
  const userId = await requireUser();
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.userId, userId)));
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath("/spots");
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
