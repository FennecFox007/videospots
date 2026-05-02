// CSV export of (filtered) campaigns. Reads the same query params as the
// /campaigns list page so the user gets exactly what they see on screen.
//
// Format choice: tab-separated isn't standard, comma is. Excel handles UTF-8
// CSV correctly only when the file has a BOM — we prepend "﻿" so Czech
// diacritics survive double-clicking the file on Windows.

import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  campaigns,
  campaignChannels,
  channels,
  countries,
  chains,
  games,
} from "@/lib/db/client";
import { findCampaignIds } from "@/lib/db/queries";
import {
  daysBetween,
  formatDate,
  statusLabel,
} from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const ids = await findCampaignIds({
    q: sp.get("q") ?? undefined,
    countryCode: sp.get("country") ?? undefined,
    chainCode: sp.get("chain") ?? undefined,
    client: sp.get("client") ?? undefined,
    status: sp.get("status") ?? undefined,
    runState: sp.get("runState") ?? undefined,
    tag: sp.get("tag") ?? undefined,
  });

  const rows =
    ids.length === 0
      ? []
      : await db
          .select({ campaign: campaigns, game: games })
          .from(campaigns)
          .leftJoin(games, eq(campaigns.gameId, games.id))
          .where(inArray(campaigns.id, ids));

  // Channel labels, grouped per campaign.
  const channelRows =
    ids.length === 0
      ? []
      : await db
          .select({
            campaignId: campaignChannels.campaignId,
            countryCode: countries.code,
            chainName: chains.name,
          })
          .from(campaignChannels)
          .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
          .innerJoin(countries, eq(channels.countryId, countries.id))
          .innerJoin(chains, eq(channels.chainId, chains.id))
          .where(inArray(campaignChannels.campaignId, ids));

  const channelsByCampaign = new Map<number, string[]>();
  for (const r of channelRows) {
    const list = channelsByCampaign.get(r.campaignId) ?? [];
    list.push(`${r.countryCode}-${r.chainName}`);
    channelsByCampaign.set(r.campaignId, list);
  }

  const HEADER = [
    "ID",
    "Název",
    "Klient",
    "Hra",
    "Stav",
    "Začátek",
    "Konec",
    "Délka (dní)",
    "Kanály",
    "Štítky",
    "Video URL",
    "Poznámky",
  ];

  const lines: string[] = [HEADER.map(esc).join(",")];
  for (const { campaign: c, game } of rows) {
    lines.push(
      [
        c.id,
        c.name,
        c.client ?? "",
        game?.name ?? "",
        statusLabel(c.status),
        formatDate(c.startsAt),
        formatDate(c.endsAt),
        daysBetween(c.startsAt, c.endsAt),
        (channelsByCampaign.get(c.id) ?? []).sort().join("; "),
        (c.tags ?? []).join("; "),
        c.videoUrl ?? "",
        c.notes ?? "",
      ]
        .map(esc)
        .join(",")
    );
  }

  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="videospots-${date}.csv"`,
    },
  });
}

/** RFC 4180 escaping: quote if contains quote/comma/newline; double interior quotes. */
function esc(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
