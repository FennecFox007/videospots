// Backend for the Cmd+K search palette. Returns ranked matches across the
// most-likely jump targets: campaigns, games, clients (distinct strings).

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, campaigns, products } from "@/lib/db/client";
import { kindLabel } from "@/lib/products";

export type SearchResult = {
  type: "campaign" | "product" | "client";
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

  const [campaignRows, productRows, clientRows] = await Promise.all([
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
    db
      .selectDistinct({ client: campaigns.client })
      .from(campaigns)
      .where(ilike(campaigns.client, like))
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
    ...clientRows
      .filter((c) => c.client)
      .map(
        (c): SearchResult => ({
          type: "client",
          label: c.client!,
          sub: "klient",
          href: `/campaigns?client=${encodeURIComponent(c.client!)}`,
        })
      ),
  ];

  return NextResponse.json(out);
}
