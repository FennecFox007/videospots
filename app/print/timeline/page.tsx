// Printable timeline view — same data as the dashboard but stripped of
// interactive UI. Reads filter params from URL so users get exactly what
// they see on screen.

import { eq, inArray, asc } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  channels,
  countries,
  chains,
} from "@/lib/db/client";
import {
  addDays,
  formatDate,
  snapToMondayStart,
  toDateInputValue,
} from "@/lib/utils";
import {
  findCampaignIds,
  fetchTimelineCampaigns,
} from "@/lib/db/queries";
import { AutoPrint } from "@/components/auto-print";
import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";

const ONE_DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 35;

function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

type SearchParams = {
  from?: string;
  to?: string;
  q?: string;
  country?: string;
  chain?: string;
  client?: string;
  status?: string;
  runState?: string;
  tag?: string;
  communicationType?: string;
};

export default async function PrintTimelinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const fromParam = parseDateParam(params.from);
  const toParam = parseDateParam(params.to);

  const rangeStart =
    fromParam ?? snapToMondayStart(addDays(new Date(), -7));
  const rangeEnd =
    toParam && toParam > rangeStart
      ? toParam
      : addDays(rangeStart, DEFAULT_RANGE_DAYS);

  const channelRows = await db
    .select({
      channelId: channels.id,
      countryId: countries.id,
      countryCode: countries.code,
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      chainName: chains.name,
    })
    .from(channels)
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id))
    .orderBy(
      asc(countries.sortOrder),
      asc(countries.code),
      asc(chains.sortOrder),
      asc(chains.name)
    );

  // Group channels by country.
  type Row = { channelId: number; chainName: string };
  type Group = {
    id: number;
    code: string;
    name: string;
    flag: string | null;
    rows: Row[];
  };
  const groupMap = new Map<number, Group>();
  for (const r of channelRows) {
    if (!groupMap.has(r.countryId)) {
      groupMap.set(r.countryId, {
        id: r.countryId,
        code: r.countryCode,
        name: r.countryName,
        flag: r.countryFlag,
        rows: [],
      });
    }
    groupMap.get(r.countryId)!.rows.push({
      channelId: r.channelId,
      chainName: r.chainName,
    });
  }
  const groups = Array.from(groupMap.values());

  // Apply same filters as the live dashboard.
  const ids = await findCampaignIds({
    q: params.q,
    countryCode: params.country,
    chainCode: params.chain,
    client: params.client,
    status: params.status,
    runState: params.runState,
    communicationType: params.communicationType,
    tag: params.tag,
    rangeStart,
    rangeEnd,
  });
  const campaignRows = await fetchTimelineCampaigns(
    ids,
    rangeStart,
    rangeEnd
  );

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const pct = (d: Date) => {
    const raw = ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
    return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
  };
  const clamp = (d: Date) =>
    d < rangeStart ? rangeStart : d > rangeEnd ? rangeEnd : d;

  // Bucket campaigns by channel.
  const byChannel = new Map<number, typeof campaignRows>();
  for (const c of campaignRows) {
    if (!byChannel.has(c.channelId)) byChannel.set(c.channelId, []);
    byChannel.get(c.channelId)!.push(c);
  }

  const distinctCount = new Set(campaignRows.map((c) => c.campaignId)).size;
  const totalDays = Math.round(totalMs / ONE_DAY_MS);
  const t = await getT();

  return (
    <div className="bg-white text-black mx-auto max-w-[1100px] px-6 py-8 print-clean">
      <AutoPrint />

      <div className="border-b-2 border-black pb-3 mb-4 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500">
            videospots · {t("print.subheading_timeline")}
          </div>
          <div className="text-base font-bold mt-0.5">
            {formatDate(rangeStart)} – {formatDate(addDays(rangeEnd, -1))}
          </div>
          <div className="text-xs text-zinc-600 mt-0.5">
            {distinctCount} {t.plural(distinctCount, "unit.campaign")} ·{" "}
            {channelRows.length} {t.plural(channelRows.length, "unit.channel")}{" "}
            · {totalDays} {t.plural(totalDays, "unit.day")}
          </div>
        </div>
        <span className="text-xs text-zinc-500">
          {t("print.generated", { date: formatDate(new Date()) })}
        </span>
      </div>

      <div className="border border-zinc-300 rounded">
        {groups.map((g, gi) => (
          <div
            key={g.id}
            className={gi > 0 ? "border-t-2 border-zinc-400" : ""}
          >
            <div className="bg-zinc-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-b border-zinc-300">
              <span className="mr-1.5">{g.flag}</span>
              {localizedCountryName(g.code, g.name, t.locale)}
            </div>
            {g.rows.map((ch, ri) => {
              const bars = byChannel.get(ch.channelId) ?? [];
              return (
                <div
                  key={ch.channelId}
                  className={
                    "flex " + (ri > 0 ? "border-t border-zinc-200" : "")
                  }
                >
                  <div className="w-32 shrink-0 px-3 py-2 text-xs border-r border-zinc-200 truncate">
                    {ch.chainName}
                  </div>
                  <div className="flex-1 relative h-7">
                    {bars.map((b, bi) => {
                      const left = pct(clamp(b.startsAt));
                      const visualEnd = new Date(
                        b.endsAt.getTime() + ONE_DAY_MS
                      );
                      const right = pct(clamp(visualEnd));
                      const width = Math.max(right - left, 0.5);
                      const isCancelled = b.status === "cancelled";
                      return (
                        <div
                          key={bi}
                          className="absolute top-0.5 h-6 text-white text-[10px] rounded px-1.5 flex items-center overflow-hidden"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: isCancelled ? "#9ca3af" : b.color,
                            textDecoration: isCancelled
                              ? "line-through"
                              : undefined,
                            // Print preserves backgrounds only when the user
                            // ticks "Background graphics" in the dialog. Most
                            // users won't — keep a high-contrast fallback.
                            WebkitPrintColorAdjust: "exact",
                            printColorAdjust: "exact",
                          }}
                        >
                          <span className="truncate font-medium">
                            {b.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-400 mt-6 text-center">
        {t("print.bg_tip")}
      </p>
    </div>
  );
}
