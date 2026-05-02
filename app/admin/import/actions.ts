"use server";

// Bulk import of campaigns from CSV. Client parses the file and posts a
// validated preview here; we re-validate and insert what's good. Errors are
// returned per-row so the user can see what got rejected and why.

import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  channels,
  countries,
  chains,
  products,
  auditLog,
} from "@/lib/db/client";
import {
  isValidCampaignColor,
  DEFAULT_CAMPAIGN_COLOR,
} from "@/lib/colors";
import { isValidKind, DEFAULT_PRODUCT_KIND } from "@/lib/products";

export type ImportRow = {
  name: string;
  client?: string;
  /** Display name of the product (game / console / controller / …). */
  productName?: string;
  /** Kind of product. Defaults to "game" if missing. */
  productKind?: string;
  startsAt: string;
  endsAt: string;
  color?: string;
  tags?: string[];
  /** Channel codes like "CZ-alza" or "SK-nay". */
  channels?: string[];
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: { rowIndex: number; message: string }[];
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function importCampaignsCsv(
  rows: ImportRow[]
): Promise<ImportResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  // Pre-load all channels for lookup. Cheap and means we don't re-query for
  // every row.
  const channelLookup = await db
    .select({
      id: channels.id,
      countryCode: countries.code,
      chainCode: chains.code,
    })
    .from(channels)
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id));

  const channelByCode = new Map<string, number>();
  for (const c of channelLookup) {
    channelByCode.set(`${c.countryCode}-${c.chainCode}`.toLowerCase(), c.id);
  }

  let imported = 0;
  let skipped = 0;
  const errors: ImportResult["errors"] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = (row.name ?? "").trim();
      if (!name) {
        errors.push({ rowIndex: i, message: "Chybí název kampaně" });
        skipped++;
        continue;
      }
      const startsAt = parseDate(row.startsAt);
      const endsAt = parseDate(row.endsAt);
      if (!startsAt || !endsAt) {
        errors.push({
          rowIndex: i,
          message: "Neplatný formát datumu (čekán YYYY-MM-DD)",
        });
        skipped++;
        continue;
      }
      if (endsAt < startsAt) {
        errors.push({
          rowIndex: i,
          message: "Konec musí být >= začátek",
        });
        skipped++;
        continue;
      }

      const color =
        row.color && isValidCampaignColor(row.color)
          ? row.color
          : DEFAULT_CAMPAIGN_COLOR;

      // Resolve channels.
      const channelIds: number[] = [];
      const unknownChannels: string[] = [];
      for (const code of row.channels ?? []) {
        const id = channelByCode.get(code.toLowerCase());
        if (id) channelIds.push(id);
        else unknownChannels.push(code);
      }
      if (channelIds.length === 0) {
        errors.push({
          rowIndex: i,
          message:
            unknownChannels.length > 0
              ? `Neznámé kanály: ${unknownChannels.join(", ")}`
              : "Žádný platný kanál",
        });
        skipped++;
        continue;
      }
      if (unknownChannels.length > 0) {
        // Soft warning: still import but flag the unrecognized ones.
        errors.push({
          rowIndex: i,
          message: `Ignorovány neznámé kanály: ${unknownChannels.join(", ")}`,
        });
      }

      // Resolve product (find or create by case-insensitive name). Accept
      // legacy "gameName" header for backwards-compat with older exports.
      let productId: number | null = null;
      const productName = (
        row.productName ??
        (row as unknown as Record<string, string | undefined>).gameName ??
        ""
      ).trim();
      const productKind =
        row.productKind && isValidKind(row.productKind)
          ? row.productKind
          : DEFAULT_PRODUCT_KIND;
      if (productName) {
        const existing = await db
          .select({ id: products.id })
          .from(products)
          .where(sql`lower(${products.name}) = lower(${productName})`)
          .limit(1);
        if (existing.length > 0) {
          productId = existing[0].id;
        } else {
          const [inserted] = await db
            .insert(products)
            .values({ name: productName, kind: productKind })
            .returning({ id: products.id });
          productId = inserted.id;
        }
      }

      const tags =
        row.tags && row.tags.length > 0
          ? Array.from(
              new Set(
                row.tags
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
                  .slice(0, 16)
              )
            )
          : null;

      const [created] = await db
        .insert(campaigns)
        .values({
          name,
          client: row.client?.trim() || null,
          status: "approved",
          color,
          tags,
          productId,
          startsAt,
          endsAt,
          createdById: userId,
        })
        .returning({ id: campaigns.id });

      await db.insert(campaignChannels).values(
        channelIds.map((channelId) => ({
          campaignId: created.id,
          channelId,
        }))
      );

      await db.insert(auditLog).values({
        action: "created",
        entity: "campaign",
        entityId: created.id,
        userId,
        changes: {
          name,
          channelCount: channelIds.length,
          via: "csv-import",
        },
      });

      imported++;
    } catch (e) {
      errors.push({
        rowIndex: i,
        message: (e as Error).message,
      });
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
