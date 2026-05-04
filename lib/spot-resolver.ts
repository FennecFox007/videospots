// Find-or-create logic for spots. Used by the campaign new/edit server
// actions: when the user types a video URL for a country, we either reuse
// an existing spot with the same (productId, countryId, videoUrl) tuple or
// insert a new one. The campaign_video junction always points at a spot.
//
// Why dedupe by (productId, countryId, videoUrl):
//  - Same product, same country, same URL = the same creative. Reusing
//    means two campaigns deploying the same spot share a single library
//    entry, which makes the /spots page (and the "undeployed spots" alert)
//    accurate.
//  - If the user changes the URL even slightly (different file version,
//    different CDN edge), it's a different spot — that's correct, the
//    creative is genuinely different.
//
// Brand campaigns without a product fall through productId=null. Two
// brand spots in the same country with the same URL still dedupe; the
// productId IS NULL branch in SQL handles the comparison.

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, spots, countries, products } from "@/lib/db/client";

/**
 * Returns the spot id for the given (product, country, url) tuple, creating
 * one if no exact match exists. The created spot's name defaults to
 * "<product> · <country code>" so the spots admin list shows something
 * legible without the user having to type a name during campaign creation.
 *
 * Caller must already have authenticated; we record createdById from the
 * passed-in userId so the spots list can show "added by Honza".
 */
export async function findOrCreateSpot(args: {
  productId: number | null;
  countryId: number;
  videoUrl: string;
  userId: string;
}): Promise<number> {
  const { productId, countryId, videoUrl, userId } = args;

  const productMatch =
    productId !== null
      ? eq(spots.productId, productId)
      : isNull(spots.productId);

  const existing = await db
    .select({ id: spots.id })
    .from(spots)
    .where(
      and(
        productMatch,
        eq(spots.countryId, countryId),
        eq(spots.videoUrl, videoUrl)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Synthesise a default name so the /spots list isn't a wall of URLs.
  // Lookup the product + country names — small queries, only run when we
  // actually create a new spot (rare path after the initial migration).
  let productName: string | null = null;
  if (productId !== null) {
    const [p] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    productName = p?.name ?? null;
  }
  const [c] = await db
    .select({ code: countries.code })
    .from(countries)
    .where(eq(countries.id, countryId))
    .limit(1);
  const countryCode = c?.code ?? "??";
  const name = productName
    ? `${productName} · ${countryCode}`
    : `Spot · ${countryCode}`;

  const [inserted] = await db
    .insert(spots)
    .values({
      productId,
      countryId,
      videoUrl,
      name,
      createdById: userId,
    })
    .returning({ id: spots.id });

  return inserted.id;
}
