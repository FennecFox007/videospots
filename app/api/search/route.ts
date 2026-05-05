// Backend for the Cmd+K search palette. Returns ranked matches across
// the most-likely jump targets: campaigns, spots, products.
//
// Spot search hits the spot's optional name, the joined product name,
// the videoUrl (so a partial URL like "youtu" finds them), and the
// country code (typing "CZ" surfaces all CZ spots). Archived spots are
// omitted — they're hidden from default lists too, so surfacing them in
// search would be noise.
//
// (There used to be a separate "client" result type linking to
// `/campaigns?client=…`; the dedicated client filter was removed, so
// typing a client name now matches campaigns directly via the
// campaigns query's ILIKE on the client column.)

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  products,
  spots,
  countries,
} from "@/lib/db/client";
import { kindLabel } from "@/lib/products";

export type SearchResult = {
  type: "campaign" | "spot" | "product";
  id?: number;
  label: string;
  /** Optional secondary line (client / kind / status / approval). */
  sub?: string;
  href: string;
  /** Hex string used as the leading dot color in the palette row.
   *  Campaigns use their bar color; spots use their approval state
   *  (emerald = approved, amber = pending); products have none and
   *  fall back to the neutral default. */
  color?: string;
};

// Approval-state colors mirror the Pill tones used elsewhere — keeps
// the palette dot in sync with the rest of the UI's status signals.
const SPOT_APPROVED_COLOR = "#10b981"; // emerald-500
const SPOT_PENDING_COLOR = "#f59e0b"; // amber-500

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([] satisfies SearchResult[]);

  const like = `%${q}%`;

  const [campaignRows, spotRows, productRows] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        client: campaigns.client,
        color: campaigns.color,
        status: campaigns.status,
        startsAt: campaigns.startsAt,
      })
      .from(campaigns)
      .where(or(ilike(campaigns.name, like), ilike(campaigns.client, like))!)
      .orderBy(desc(campaigns.startsAt))
      .limit(6),
    db
      .select({
        id: spots.id,
        name: spots.name,
        videoUrl: spots.videoUrl,
        productName: products.name,
        countryCode: countries.code,
        countryFlag: countries.flagEmoji,
        clientApprovedAt: spots.clientApprovedAt,
      })
      .from(spots)
      .leftJoin(products, eq(spots.productId, products.id))
      .innerJoin(countries, eq(spots.countryId, countries.id))
      .where(
        and(
          // Skip archived — they're hidden everywhere else, search
          // surfacing them would just confuse.
          isNull(spots.archivedAt),
          or(
            ilike(spots.name, like),
            ilike(products.name, like),
            ilike(spots.videoUrl, like),
            ilike(countries.code, like)
          )
        )!
      )
      .orderBy(desc(spots.createdAt))
      .limit(6),
    db
      .select({ id: products.id, name: products.name, kind: products.kind })
      .from(products)
      .where(ilike(products.name, like))
      .limit(3),
  ]);

  const out: SearchResult[] = [
    ...campaignRows.map(
      (c): SearchResult => ({
        type: "campaign",
        id: c.id,
        label: c.name,
        sub: [c.client, c.status === "cancelled" ? "zrušeno" : null]
          .filter(Boolean)
          .join(" · "),
        href: `/campaigns/${c.id}`,
        color: c.color,
      })
    ),
    ...spotRows.map((s): SearchResult => {
      // Synthesize a label when the spot has no explicit name — same
      // pattern the /spots list uses ("Saros Launch · CZ").
      const label =
        s.name ??
        (s.productName
          ? `${s.productName} · ${s.countryCode}`
          : `Spot · ${s.countryCode}`);
      const approved = s.clientApprovedAt !== null;
      const subParts: string[] = [
        `${s.countryFlag ?? ""} ${s.countryCode}`.trim(),
      ];
      // If the label ALREADY mentions the product (synthesized), don't
      // duplicate it. If the spot has its own name AND a product, show
      // the product as context.
      if (s.name && s.productName) {
        subParts.push(s.productName);
      }
      subParts.push(approved ? "Schváleno" : "Čeká na schválení");
      return {
        type: "spot",
        id: s.id,
        label,
        sub: subParts.join(" · "),
        href: `/spots/${s.id}`,
        color: approved ? SPOT_APPROVED_COLOR : SPOT_PENDING_COLOR,
      };
    }),
    ...productRows.map(
      (p): SearchResult => ({
        type: "product",
        id: p.id,
        label: p.name,
        sub: kindLabel(p.kind),
        href: `/campaigns?q=${encodeURIComponent(p.name)}`,
      })
    ),
  ];

  return NextResponse.json(out);
}
