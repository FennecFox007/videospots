// "Best-slot finder" — given a set of channels and a desired duration, finds
// the earliest free windows where ALL selected channels are unbooked.
//
// Algorithm (O(n log n) where n = total busy intervals across selected channels):
// 1. Collect busy intervals from approved (non-archived) campaigns on those channels.
// 2. Sort by start, merge overlaps → union of "any channel busy" times.
// 3. Walk gaps between merged intervals; emit any gap ≥ duration as a slot.

import Link from "next/link";
import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
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
  pluralCs,
  toDateInputValue,
} from "@/lib/utils";

const ONE_DAY_MS = 86_400_000;
const HORIZON_DAYS = 365;

type SearchParams = {
  channels?: string | string[];
  duration?: string;
  from?: string;
};

function parseChannelIds(p: SearchParams["channels"]): number[] {
  const raw = Array.isArray(p)
    ? p
    : typeof p === "string"
      ? p.split(",")
      : [];
  return raw
    .flatMap((s) => s.split(","))
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseDateParam(s: string | undefined): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!s) return today;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return today;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : today;
}

type Slot = { start: Date; end: Date }; // end is exclusive

function findFreeSlots(
  busy: { startsAt: Date; endsAt: Date }[],
  durationDays: number,
  searchStart: Date,
  searchEnd: Date,
  maxResults: number = 8
): Slot[] {
  const durationMs = durationDays * ONE_DAY_MS;

  // Convert to half-open intervals [start, end_exclusive). A campaign that runs
  // through May 14 has endsAt = May 14 00:00; the next free moment is May 15.
  const intervals = busy
    .map((b) => ({
      start: b.startsAt,
      end: new Date(b.endsAt.getTime() + ONE_DAY_MS),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlaps.
  const merged: { start: Date; end: Date }[] = [];
  for (const iv of intervals) {
    if (
      merged.length === 0 ||
      iv.start.getTime() > merged[merged.length - 1].end.getTime()
    ) {
      merged.push({ start: iv.start, end: iv.end });
    } else {
      const last = merged[merged.length - 1];
      if (iv.end.getTime() > last.end.getTime()) last.end = iv.end;
    }
  }

  // Walk gaps.
  const slots: Slot[] = [];
  let cursor = searchStart;
  for (const iv of merged) {
    if (iv.end.getTime() <= cursor.getTime()) continue;
    if (iv.start.getTime() > cursor.getTime()) {
      const gapMs = iv.start.getTime() - cursor.getTime();
      if (gapMs >= durationMs) {
        slots.push({
          start: new Date(cursor),
          end: new Date(cursor.getTime() + durationMs),
        });
        if (slots.length >= maxResults) return slots;
      }
    }
    if (iv.end.getTime() > cursor.getTime()) cursor = iv.end;
  }
  // Trailing gap to horizon.
  if (
    cursor.getTime() < searchEnd.getTime() &&
    searchEnd.getTime() - cursor.getTime() >= durationMs
  ) {
    slots.push({
      start: new Date(cursor),
      end: new Date(cursor.getTime() + durationMs),
    });
  }
  return slots;
}

export default async function FindSlotPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const channelIds = parseChannelIds(params.channels);
  const duration = Math.max(
    1,
    Math.min(180, Number(params.duration) || 7)
  );
  const fromDate = parseDateParam(params.from);
  const horizon = addDays(fromDate, HORIZON_DAYS);

  // Fetch all channels for the picker (and labels for selected ones).
  const allChannels = await db
    .select({
      channelId: channels.id,
      countryId: countries.id,
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

  type Group = {
    id: number;
    name: string;
    flag: string | null;
    items: { id: number; name: string }[];
  };
  const groupMap = new Map<number, Group>();
  for (const r of allChannels) {
    if (!groupMap.has(r.countryId)) {
      groupMap.set(r.countryId, {
        id: r.countryId,
        name: r.countryName,
        flag: r.countryFlag,
        items: [],
      });
    }
    groupMap.get(r.countryId)!.items.push({
      id: r.channelId,
      name: r.chainName,
    });
  }
  const groups = Array.from(groupMap.values());

  // Find slots.
  let slots: Slot[] = [];
  let busyCount = 0;
  if (channelIds.length > 0) {
    const busy = await db
      .select({
        startsAt: campaigns.startsAt,
        endsAt: campaigns.endsAt,
      })
      .from(campaigns)
      .innerJoin(
        campaignChannels,
        eq(campaigns.id, campaignChannels.campaignId)
      )
      .where(
        and(
          eq(campaigns.status, "approved"),
          isNull(campaigns.archivedAt),
          inArray(campaignChannels.channelId, channelIds),
          gte(campaigns.endsAt, fromDate)
        )
      );
    busyCount = busy.length;
    slots = findFreeSlots(busy, duration, fromDate, horizon);
  }

  const selectedSet = new Set(channelIds);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Timeline
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">
          Najít volný termín
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Vyber kanály a požadovanou délku — najdu nejbližší volné období,
          kde se na žádném vybraném kanálu nepřekrývá schválená kampaň.
          Hledá se {HORIZON_DAYS} dní dopředu od zadaného data.
        </p>
      </div>

      <form
        method="get"
        className="space-y-4 rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
              Délka kampaně (dní)
            </label>
            <input
              name="duration"
              type="number"
              min={1}
              max={180}
              defaultValue={duration}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
              Hledat od
            </label>
            <input
              name="from"
              type="date"
              defaultValue={toDateInputValue(fromDate)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Kanály</div>
          <div className="space-y-2">
            {groups.map((g) => (
              <fieldset
                key={g.id}
                className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3"
              >
                <legend className="text-xs font-semibold px-1">
                  <span className="mr-1">{g.flag}</span>
                  {g.name}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((ch) => (
                    <label
                      key={ch.id}
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm cursor-pointer transition-colors has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:text-blue-900 dark:has-[:checked]:bg-blue-950/40 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:text-blue-100"
                    >
                      <input
                        type="checkbox"
                        name="channels"
                        value={ch.id}
                        defaultChecked={selectedSet.has(ch.id)}
                        className="rounded"
                      />
                      {ch.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
          >
            Najít volný termín
          </button>
        </div>
      </form>

      {channelIds.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-medium">
              {slots.length === 0
                ? "Nenalezeno"
                : `Výsledky (top ${slots.length})`}
            </h2>
            <span className="text-xs text-zinc-500">
              {channelIds.length}{" "}
              {pluralCs(channelIds.length, "kanál", "kanály", "kanálů")} ·{" "}
              {busyCount}{" "}
              {pluralCs(
                busyCount,
                "obsazený interval",
                "obsazené intervaly",
                "obsazených intervalů"
              )}
            </span>
          </div>

          {slots.length === 0 ? (
            <p className="text-sm text-zinc-500">
              V příštích {HORIZON_DAYS} dnech není volný{" "}
              {duration}denní úsek napříč všemi vybranými kanály. Zkus
              kratší dobu nebo méně kanálů.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {slots.map((s, i) => {
                const dispEnd = addDays(s.end, -1); // end was exclusive
                const daysFromNow = Math.max(
                  0,
                  Math.round(
                    (s.start.getTime() - Date.now()) / ONE_DAY_MS
                  )
                );
                const createUrl = `/campaigns/new?channels=${channelIds.join(",")}&from=${toDateInputValue(s.start)}&to=${toDateInputValue(dispEnd)}`;
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <div className="font-medium">
                        {formatDate(s.start)} – {formatDate(dispEnd)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {duration}{" "}
                        {pluralCs(duration, "den", "dny", "dní")}
                        {daysFromNow > 0 &&
                          ` · za ${daysFromNow} ${pluralCs(daysFromNow, "den", "dny", "dní")}`}
                      </div>
                    </div>
                    <Link
                      href={createUrl}
                      className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                    >
                      Vytvořit zde →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
