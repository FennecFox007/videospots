import {
  asc,
  eq,
  inArray,
  and,
  isNull,
  lte,
  gte,
  gt,
  sql,
} from "drizzle-orm";
import Link from "next/link";
import {
  db,
  channels,
  countries,
  chains,
  campaigns,
  campaignChannels,
  products,
} from "@/lib/db/client";
import {
  Timeline,
  type TimelineCountryGroup,
} from "@/components/timeline";
import { FilterBar } from "@/components/filter-bar";
import { TimelineShareButton } from "@/components/timeline-share-button";
import {
  formatDate,
  pluralCs,
  addDays,
  snapToMondayStart,
  toDateInputValue,
} from "@/lib/utils";
import {
  findCampaignIds,
  getFilterOptions,
  fetchTimelineCampaigns,
} from "@/lib/db/queries";
import { listSavedViews } from "@/app/saved-views/actions";
import { auth } from "@/auth";

const ONE_DAY_MS = 86_400_000;
const DEFAULT_OFFSET_DAYS = -7;
const DEFAULT_RANGE_DAYS = 35;

function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

function defaultRangeStart(): Date {
  return snapToMondayStart(addDays(new Date(), DEFAULT_OFFSET_DAYS));
}

function rangeUrl(start: Date, days: number, extra?: URLSearchParams): string {
  const end = addDays(start, days);
  const params = new URLSearchParams(extra);
  params.set("from", toDateInputValue(start));
  params.set("to", toDateInputValue(end));
  return `/?${params.toString()}`;
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

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const fromParam = parseDateParam(params.from);
  const toParam = parseDateParam(params.to);
  const rangeStart = fromParam ?? defaultRangeStart();
  const rangeEnd =
    toParam && toParam > rangeStart
      ? toParam
      : addDays(rangeStart, DEFAULT_RANGE_DAYS);

  const totalDays = Math.round(
    (rangeEnd.getTime() - rangeStart.getTime()) / ONE_DAY_MS
  );

  // ---- Channels (always all of them, never filtered — we need empty rows too)
  const channelRows = await db
    .select({
      channelId: channels.id,
      countryId: countries.id,
      countryCode: countries.code,
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      chainName: chains.name,
      chainCode: chains.code,
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

  const groupMap = new Map<number, TimelineCountryGroup>();
  for (const r of channelRows) {
    if (!groupMap.has(r.countryId)) {
      groupMap.set(r.countryId, {
        id: r.countryId,
        code: r.countryCode,
        name: r.countryName,
        flag: r.countryFlag,
        channels: [],
      });
    }
    groupMap.get(r.countryId)!.channels.push({
      id: r.channelId,
      chainName: r.chainName,
      chainCode: r.chainCode,
    });
  }
  const groups = Array.from(groupMap.values());

  // ---- Filter campaigns
  const filters = {
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
  };
  const matchingIds = await findCampaignIds(filters);
  const campaignRows = await fetchTimelineCampaigns(
    matchingIds,
    rangeStart,
    rangeEnd
  );

  const distinctCampaignCount = new Set(
    campaignRows.map((c) => c.campaignId)
  ).size;

  // ---- Live "running now" + "upcoming" + "ending soon" widgets
  const now = new Date();
  const UPCOMING_WINDOW_DAYS = 30;
  const ENDING_WINDOW_DAYS = 7;
  const upcomingHorizon = addDays(now, UPCOMING_WINDOW_DAYS);
  const endingHorizon = addDays(now, ENDING_WINDOW_DAYS);

  const [runningRows, upcomingRows, endingRows] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        color: campaigns.color,
        startsAt: campaigns.startsAt,
        endsAt: campaigns.endsAt,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "approved"),
          isNull(campaigns.archivedAt),
          lte(campaigns.startsAt, now),
          gte(campaigns.endsAt, now)
        )
      )
      .orderBy(asc(campaigns.endsAt)),
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        color: campaigns.color,
        startsAt: campaigns.startsAt,
        endsAt: campaigns.endsAt,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "approved"),
          isNull(campaigns.archivedAt),
          gt(campaigns.startsAt, now),
          lte(campaigns.startsAt, upcomingHorizon)
        )
      )
      .orderBy(asc(campaigns.startsAt))
      .limit(8),
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        color: campaigns.color,
        startsAt: campaigns.startsAt,
        endsAt: campaigns.endsAt,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "approved"),
          isNull(campaigns.archivedAt),
          // Currently running (started already), ending within window.
          lte(campaigns.startsAt, now),
          gte(campaigns.endsAt, now),
          lte(campaigns.endsAt, endingHorizon)
        )
      )
      .orderBy(asc(campaigns.endsAt))
      .limit(8),
  ]);

  const allFeaturedIds = [
    ...runningRows.map((r) => r.id),
    ...upcomingRows.map((r) => r.id),
    ...endingRows.map((r) => r.id),
  ];
  const channelReachRows =
    allFeaturedIds.length > 0
      ? await db
          .select({
            campaignId: campaignChannels.campaignId,
            count: sql<number>`count(*)::int`,
          })
          .from(campaignChannels)
          .where(inArray(campaignChannels.campaignId, allFeaturedIds))
          .groupBy(campaignChannels.campaignId)
      : [];
  const channelCountByCampaign = new Map(
    channelReachRows.map((r) => [r.campaignId, r.count])
  );

  const runningChannelTotal = runningRows.reduce(
    (s, r) => s + (channelCountByCampaign.get(r.id) ?? 0),
    0
  );

  // ---- Filter options + toolbar URLs
  const filterOpts = await getFilterOptions();

  // Saved-views menu in the FilterBar — only fetched if there's an auth'd
  // user. (The dashboard is auth-gated globally, so this should always
  // succeed; the auth check is just defensive.)
  const session = await auth();
  const savedViewsList = session?.user
    ? await listSavedViews("timeline")
    : [];

  const todayMondayStart = snapToMondayStart(new Date());
  const queryParamsForward = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "from" || k === "to") continue;
    if (typeof v === "string" && v) queryParamsForward.set(k, v);
  }
  const shiftBackStart = addDays(rangeStart, -7);
  const shiftFwdStart = addDays(rangeStart, 7);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {formatDate(rangeStart)} – {formatDate(addDays(rangeEnd, -1))} ·{" "}
            {distinctCampaignCount}{" "}
            {pluralCs(distinctCampaignCount, "kampaň", "kampaně", "kampaní")} ·{" "}
            {channelRows.length} kanálů
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TimelineShareButton />
          <a
            href={`/print/timeline?${queryParamsForward}${queryParamsForward.toString() ? "&" : ""}from=${toDateInputValue(rangeStart)}&to=${toDateInputValue(rangeEnd)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            title="Tisková podoba aktuální timeline"
          >
            Tisk / PDF
          </a>
          <Link
            href="/campaigns"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Seznam kampaní
          </Link>
          <Link
            href="/campaigns/new"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
          >
            + Nová kampaň
          </Link>
        </div>
      </div>

      {/* Live trio: running now / upcoming / ending soon */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <LiveRunningCard
          running={runningRows}
          channelCount={runningChannelTotal}
          channelCountByCampaign={channelCountByCampaign}
        />
        <UpcomingCard
          upcoming={upcomingRows}
          windowDays={UPCOMING_WINDOW_DAYS}
          channelCountByCampaign={channelCountByCampaign}
        />
        <EndingSoonCard
          ending={endingRows}
          windowDays={ENDING_WINDOW_DAYS}
          channelCountByCampaign={channelCountByCampaign}
        />
      </div>

      {/* Range navigator + zoom + contextual presets */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
          <Link
            href={rangeUrl(shiftBackStart, totalDays, queryParamsForward)}
            className="px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-r border-zinc-300 dark:border-zinc-700"
            title="Posunout o týden zpět"
          >
            ←
          </Link>
          <Link
            href={rangeUrl(
              snapToMondayStart(addDays(new Date(), -7)),
              35,
              queryParamsForward
            )}
            className="px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-r border-zinc-300 dark:border-zinc-700 font-medium"
          >
            Dnes
          </Link>
          <Link
            href={rangeUrl(shiftFwdStart, totalDays, queryParamsForward)}
            className="px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Posunout o týden vpřed"
          >
            →
          </Link>
        </div>

        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
          {(
            [
              { label: "Týden", days: 7 },
              { label: "2 týdny", days: 14 },
              { label: "Měsíc", days: 35 },
              { label: "Kvartál", days: 84 },
            ] as const
          ).map((z, i, arr) => {
            const active = totalDays === z.days;
            return (
              <Link
                key={z.label}
                href={rangeUrl(todayMondayStart, z.days, queryParamsForward)}
                className={
                  "px-3 py-1.5 transition-colors " +
                  (active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800") +
                  (i < arr.length - 1
                    ? " border-r border-zinc-300 dark:border-zinc-700"
                    : "")
                }
              >
                {z.label}
              </Link>
            );
          })}
        </div>

        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden text-xs">
          {(() => {
            // Contextual presets snapped to calendar boundaries.
            const today = new Date();
            const thisMonday = snapToMondayStart(today);
            const thisMonthStart = new Date(
              today.getFullYear(),
              today.getMonth(),
              1
            );
            const nextMonthStart = new Date(
              today.getFullYear(),
              today.getMonth() + 1,
              1
            );
            const monthEnd = new Date(
              today.getFullYear(),
              today.getMonth() + 1,
              1
            );
            const nextMonthEndExclusive = new Date(
              today.getFullYear(),
              today.getMonth() + 2,
              1
            );
            const presets = [
              {
                label: "Tento týden",
                start: thisMonday,
                days: 7,
              },
              {
                label: "Příští týden",
                start: addDays(thisMonday, 7),
                days: 7,
              },
              {
                label: "Tento měsíc",
                start: thisMonthStart,
                days: Math.round(
                  (monthEnd.getTime() - thisMonthStart.getTime()) /
                    ONE_DAY_MS
                ),
              },
              {
                label: "Příští měsíc",
                start: nextMonthStart,
                days: Math.round(
                  (nextMonthEndExclusive.getTime() -
                    nextMonthStart.getTime()) /
                    ONE_DAY_MS
                ),
              },
            ];
            return presets.map((p, i) => (
              <Link
                key={p.label}
                href={rangeUrl(p.start, p.days, queryParamsForward)}
                className={
                  "px-2.5 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 " +
                  (i < presets.length - 1
                    ? "border-r border-zinc-300 dark:border-zinc-700"
                    : "")
                }
              >
                {p.label}
              </Link>
            ));
          })()}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        countries={filterOpts.countries}
        chains={filterOpts.chains}
        clients={filterOpts.clients}
        tags={filterOpts.tags}
        savedViews={{
          scope: "timeline",
          destinationPath: "/",
          views: savedViewsList,
        }}
      />

      <p className="text-xs text-zinc-500">
        Tip: táhni za střed = posun, za okraj = délka, klik = otevřít detail.
        Hlavičku s dny chytni a táhni pro posun v čase. Shift+táhnout = snap
        na pondělí. Dvojklik na hlavičku = skok na dnešek.
      </p>

      <Timeline
        groups={groups}
        campaigns={campaignRows}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        now={now}
      />

      {/* Dashboard stats */}
      <DashboardStats />
    </div>
  );
}

function LiveRunningCard({
  running,
  channelCount,
  channelCountByCampaign,
}: {
  running: {
    id: number;
    name: string;
    color: string;
    startsAt: Date;
    endsAt: Date;
  }[];
  channelCount: number;
  channelCountByCampaign: Map<number, number>;
}) {
  if (running.length === 0) {
    return (
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="font-medium text-sm text-zinc-500">
            Právě teď nic neběží
          </span>
        </div>
        <p className="text-xs text-zinc-500">Žádná kampaň se status „aktivní" se právě teď nepřehrává.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-medium text-sm text-emerald-900 dark:text-emerald-200">
          Právě běží: {running.length}{" "}
          {pluralCs(running.length, "kampaň", "kampaně", "kampaní")} na{" "}
          {channelCount} {pluralCs(channelCount, "kanálu", "kanálech", "kanálech")}
        </span>
      </div>
      <ul className="divide-y divide-emerald-200/60 dark:divide-emerald-900/40">
        {running.map((r) => (
          <li key={r.id}>
            <Link
              href={`/campaigns/${r.id}`}
              className="flex items-center gap-2 py-1.5 text-xs hover:underline"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: r.color }}
              />
              <span className="font-medium truncate flex-1">{r.name}</span>
              <span className="text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                {channelCountByCampaign.get(r.id) ?? 0}× kanál · do {formatDate(r.endsAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpcomingCard({
  upcoming,
  windowDays,
  channelCountByCampaign,
}: {
  upcoming: {
    id: number;
    name: string;
    color: string;
    startsAt: Date;
    endsAt: Date;
  }[];
  windowDays: number;
  channelCountByCampaign: Map<number, number>;
}) {
  if (upcoming.length === 0) {
    return (
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="font-medium text-sm text-zinc-500">
            Žádné naplánované
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          V příštích {windowDays} dnech není naplánovaná žádná schválená kampaň.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-300 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        <span className="font-medium text-sm text-blue-900 dark:text-blue-200">
          Naplánováno na příštích {windowDays} dní: {upcoming.length}{" "}
          {pluralCs(upcoming.length, "kampaň", "kampaně", "kampaní")}
        </span>
      </div>
      <ul className="divide-y divide-blue-200/60 dark:divide-blue-900/40">
        {upcoming.map((u) => {
          const daysUntil = Math.max(
            1,
            Math.ceil(
              (u.startsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          );
          return (
            <li key={u.id}>
              <Link
                href={`/campaigns/${u.id}`}
                className="flex items-center gap-2 py-1.5 text-xs hover:underline"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: u.color }}
                />
                <span className="font-medium truncate flex-1">{u.name}</span>
                <span className="text-blue-700 dark:text-blue-400 whitespace-nowrap">
                  {channelCountByCampaign.get(u.id) ?? 0}× kanál · za {daysUntil}{" "}
                  {pluralCs(daysUntil, "den", "dny", "dní")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EndingSoonCard({
  ending,
  windowDays,
  channelCountByCampaign,
}: {
  ending: {
    id: number;
    name: string;
    color: string;
    startsAt: Date;
    endsAt: Date;
  }[];
  windowDays: number;
  channelCountByCampaign: Map<number, number>;
}) {
  if (ending.length === 0) {
    return (
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="font-medium text-sm text-zinc-500">
            Žádná kampaň brzy nekončí
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          V příštích {windowDays} dnech nekončí žádná aktivně běžící kampaň.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <span className="font-medium text-sm text-amber-900 dark:text-amber-200">
          Konec do {windowDays} dnů: {ending.length}{" "}
          {pluralCs(ending.length, "kampaň", "kampaně", "kampaní")}
        </span>
      </div>
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
        {ending.map((e) => {
          const daysLeft = Math.max(
            0,
            Math.ceil(
              (e.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          );
          return (
            <li key={e.id}>
              <Link
                href={`/campaigns/${e.id}`}
                className="flex items-center gap-2 py-1.5 text-xs hover:underline"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: e.color }}
                />
                <span className="font-medium truncate flex-1">{e.name}</span>
                <span className="text-amber-700 dark:text-amber-400 whitespace-nowrap">
                  {channelCountByCampaign.get(e.id) ?? 0}× kanál ·{" "}
                  {daysLeft === 0
                    ? "dnes"
                    : `za ${daysLeft} ${pluralCs(daysLeft, "den", "dny", "dní")}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function DashboardStats() {
  // This-month window
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  const [thisMonthCount, totalCount, topClients, topGames, monthCampaigns] =
    await Promise.all([
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(
          and(
            isNull(campaigns.archivedAt),
            lte(campaigns.startsAt, monthEnd),
            gte(campaigns.endsAt, monthStart)
          )
        ),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(isNull(campaigns.archivedAt)),
      db
        .select({
          client: campaigns.client,
          c: sql<number>`count(*)::int`,
        })
        .from(campaigns)
        .where(
          and(
            isNull(campaigns.archivedAt),
            sql`${campaigns.client} IS NOT NULL`
          )
        )
        .groupBy(campaigns.client)
        .orderBy(sql`count(*) desc`)
        .limit(3),
      db
        .select({
          name: products.name,
          c: sql<number>`count(*)::int`,
        })
        .from(campaigns)
        .innerJoin(products, eq(campaigns.productId, products.id))
        .where(isNull(campaigns.archivedAt))
        .groupBy(products.name)
        .orderBy(sql`count(*) desc`)
        .limit(3),
      // Approved campaigns overlapping this month — used for screen-days math.
      db
        .select({
          id: campaigns.id,
          startsAt: campaigns.startsAt,
          endsAt: campaigns.endsAt,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.status, "approved"),
            isNull(campaigns.archivedAt),
            lte(campaigns.startsAt, monthEnd),
            gte(campaigns.endsAt, monthStart)
          )
        ),
    ]);

  // Screen-days = Σ (days the campaign runs in this month × number of channels
  // it targets). Computed in JS — small dataset, avoids fragile SQL casting.
  let screenDays = 0;
  if (monthCampaigns.length > 0) {
    const channelCounts = await db
      .select({
        campaignId: campaignChannels.campaignId,
        count: sql<number>`count(*)::int`,
      })
      .from(campaignChannels)
      .where(
        inArray(
          campaignChannels.campaignId,
          monthCampaigns.map((c) => c.id)
        )
      )
      .groupBy(campaignChannels.campaignId);
    const channelsByCampaign = new Map(
      channelCounts.map((r) => [r.campaignId, r.count])
    );
    for (const c of monthCampaigns) {
      const start =
        c.startsAt > monthStart ? c.startsAt : monthStart;
      const end = c.endsAt < monthEnd ? c.endsAt : monthEnd;
      const days = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1
      );
      screenDays += days * (channelsByCampaign.get(c.id) ?? 0);
    }
  }

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mt-2">
      <StatCard
        label="Celkem kampaní"
        value={totalCount[0].c}
        sub={`${thisMonthCount[0].c} běží/poběží v ${monthStart.toLocaleDateString("cs-CZ", { month: "long" })}`}
      />
      <StatCard
        label="Screen-days tento měsíc"
        value={screenDays}
        sub="aktivních × dní × kanálů"
      />
      <StatCard
        label="Top klient"
        value={topClients[0]?.client ?? "—"}
        sub={topClients[0] ? `${topClients[0].c} kampaní` : "zatím žádný"}
        small
      />
      <StatCard
        label="Top hra"
        value={topGames[0]?.name ?? "—"}
        sub={topGames[0] ? `${topGames[0].c} kampaní` : "zatím žádná"}
        small
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: string | number;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <div
        className={
          (small ? "text-base " : "text-2xl ") + "font-semibold truncate"
        }
        title={String(value)}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs text-zinc-500 mt-1 truncate">{sub}</div>
      )}
    </div>
  );
}
