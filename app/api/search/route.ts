// Backend for the Cmd+K search palette. Returns ranked matches across the
// most-likely jump targets: campaigns and products.
//
// Used to also surface distinct client strings as a separate row type
// linking to `/campaigns?client=<name>`, but the `?client=` filter was
// removed. Typing a client name still finds matching campaigns directly
// because the campaign query ILIKEs both name AND client.

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, campaigns, products } from "@/lib/db/client";
import { kindLabel } from "@/lib/products";

export type SearchResult = {
  type: "campaign" | "product";
  id?: number;
  label: string;
  /** Optional secondary line (client / kind / status). */
  sub?: string;
  href: string;
  color?: string;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([] satisfies SearchResult[]);

  const like = `%${q}%`;

  const [campaignRows, productRows] = await Promise.all([
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
      .limit(8),
    db
      .select({ id: products.id, name: products.name, kind: products.kind })
      .from(products)
      .where(ilike(products.name, like))
      .limit(4),
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
