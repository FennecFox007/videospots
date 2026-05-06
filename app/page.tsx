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
  Play,
  CalendarDays,
  Clock,
  Activity,
  Megaphone,
  CheckCircle2,
  Share2,
  Printer,
  Plus,
} from "lucide-react";
import {
  db,
  channels,
  countries,
  chains,
  campaigns,
  campaignChannels,
  spots,
  auditLog,
} from "@/lib/db/client";
import {
  Timeline,
  type TimelineCountryGroup,
} from "@/components/timeline";
import { FilterBar } from "@/components/filter-bar";
import { TimelineShareButton } from "@/components/timeline-share-button";
import { SpotsDrawer } from "@/components/spots-drawer";
import { SpotDropModal } from "@/components/spot-drop-modal";
import { TimelineTip } from "@/components/timeline-tip";
import {
  formatDate,
  addDays,
  snapToMondayStart,
  toDateInputValue,
} from "@/lib/utils";
import {
  findCampaignIds,
  getFilterOptions,
  fetchTimelineCampaigns,
  getSpotsForDrawer,
  spotIsUndeployedSql,
} from "@/lib/db/queries";
import { listSavedViews } from "@/app/saved-views/actions";
import { auth } from "@/auth";
import { getT } from "@/lib/i18n/server";

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
  status?: string;
  runState?: string;
  tag?: string;
  approval?: string;
  missingSpot?: string;
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
    status: params.status,
    runState: params.runState,
    approval: params.approval,
    missingSpot: params.missingSpot,
    tag: params.tag,
    rangeStart,
    rangeEnd,
  };
  const matchingIds = await findCampaignIds(filters);
  const [campaignRows, drawerSpots] = await Promise.all([
    fetchTimelineCampaigns(matchingIds, rangeStart, rangeEnd),
    getSpotsForDrawer(),
  ]);

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

  const t = await getT();
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
        <div className="min-w-0">
          {/* Title + meta line. Tighter hierarchy than before — h1 still
              the visual anchor, but the meta sub-text is now xs/zinc-500
              so it reads as auxiliary chrome, not a second-level heading. */}
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("timeline.heading")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {formatDate(rangeStart)} – {formatDate(addDays(rangeEnd, -1))} ·{" "}
            {distinctCampaignCount}{" "}
            {t.plural(distinctCampaignCount, "unit.campaign")} ·{" "}
            {channelRows.length}{" "}
            {t.plural(channelRows.length, "unit.channel")}
          </p>
        </div>
        {/* Toolbar — two visual groups with a thin divider between:
              left  = read-only navigation (list / print / share)
              right = creation surfaces (library drawer / new campaign)
            Knihovna sits next to + Nová so the action that opens the
            right-side drawer is spatially adjacent to where the drawer
            appears, and the primary CTA stays rightmost. */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/print/timeline?${queryParamsForward}${queryParamsForward.toString() ? "&" : ""}from=${toDateInputValue(rangeStart)}&to=${toDateInputValue(rangeEnd)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5"
            title={t("timeline.print")}
          >
            <Printer className="w-4 h-4" strokeWidth={2} />
            {t("timeline.print")}
          </a>
          <TimelineShareButton />

          <span
            aria-hidden
            className="hidden sm:inline-block w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1"
          />

          {/* SpotsDrawer renders both the toolbar trigger button and the
              floating slide-out drawer. Click → drawer; drag a spot card
              onto a Timeline channel row → SpotDropModal opens at the
              bottom of the page (mounted below). */}
          <SpotsDrawer spots={drawerSpots} />
          <Link
            href="/campaigns/new"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3.5 py-2 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {t("timeline.new_campaign")}
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
            title={t("timeline.shift_back")}
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
            {t("timeline.today")}
          </Link>
          <Link
            href={rangeUrl(shiftFwdStart, totalDays, queryParamsForward)}
            className="px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title={t("timeline.shift_forward")}
          >
            →
          </Link>
        </div>

        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
          {(
            [
              { label: t("timeline.zoom_week"), days: 7 },
              { label: t("timeline.zoom_2weeks"), days: 14 },
              { label: t("timeline.zoom_month"), days: 35 },
              { label: t("timeline.zoom_quarter"), days: 84 },
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

        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
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
                label: t("timeline.preset_this_week"),
                start: thisMonday,
                days: 7,
              },
              {
                label: t("timeline.preset_next_week"),
                start: addDays(thisMonday, 7),
                days: 7,
              },
              {
                label: t("timeline.preset_this_month"),
                start: thisMonthStart,
                days: Math.round(
                  (monthEnd.getTime() - thisMonthStart.getTime()) /
                    ONE_DAY_MS
                ),
              },
              {
                label: t("timeline.preset_next_month"),
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
                  "px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 " +
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
        tags={filterOpts.tags}
        savedViews={{
          scope: "timeline",
          destinationPath: "/",
          views: savedViewsList,
        }}
      />

      <TimelineTip />

      <Timeline
        groups={groups}
        campaigns={campaignRows}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        now={now}
      />

      {/* Dashboard stats */}
      <DashboardStats />

      {/* Drag-from-drawer drop modal. Inert until something calls
          setPendingDrop in spot-drop-store; kept at page level so it can
          read the country → channels grouping the timeline already
          computed (drives the checkbox list of "other channels in this
          country"). */}
      <SpotDropModal
        groupsByCountry={groups.map((g) => ({
          countryId: g.id,
          channels: g.channels.map((c) => ({
            id: c.id,
            chainName: c.chainName,
          })),
        }))}
      />
    </div>
  );
}

async function LiveRunningCard({
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
  const t = await getT();
  if (running.length === 0) {
    return (
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-3.5 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Play
              className="w-4 h-4 text-zinc-400 dark:text-zinc-500"
              strokeWidth={2}
              fill="currentColor"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("dashboard.running.empty_title")}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t("dashboard.running.empty_desc")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg ring-1 ring-emerald-200/70 dark:ring-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-3.5 py-3">
      <div className="flex items-start gap-3 mb-2">
        {/* Pulsing icon — animate-ping on the bg ring keeps the
            "active right now" cue without the dot taking up its
            own column. */}
        <div className="relative shrink-0 w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 dark:bg-emerald-500/20 animate-ping" />
          <Play
            className="relative w-4 h-4 text-emerald-600 dark:text-emerald-400"
            strokeWidth={2}
            fill="currentColor"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            {t("dashboard.running.title")}
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">
            {running.length} {t.plural(running.length, "unit.campaign")}
            {channelCount > 0 && (
              <>
                <span className="text-zinc-400 dark:text-zinc-600 mx-1">·</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {channelCount} {t.plural(channelCount, "unit.channel")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <ul className="divide-y divide-emerald-200/40 dark:divide-emerald-900/30">
        {running.map((r) => (
          <li key={r.id}>
            <Link
              href={`/campaigns/${r.id}`}
              className="flex items-center gap-2 py-1 text-xs hover:underline"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: r.color }}
              />
              <span className="font-medium truncate flex-1">{r.name}</span>
              <span className="text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                {channelCountByCampaign.get(r.id) ?? 0}×{" "}
                {t("common.channels").toLowerCase()} ·{" "}
                {t("dashboard.until", { date: formatDate(r.endsAt) })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function UpcomingCard({
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
  const t = await getT();
  if (upcoming.length === 0) {
    return (
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-3.5 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <CalendarDays
              className="w-4 h-4 text-zinc-400 dark:text-zinc-500"
              strokeWidth={2}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("dashboard.upcoming.empty_title")}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t("dashboard.upcoming.empty_desc", { days: windowDays })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg ring-1 ring-blue-200/70 dark:ring-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 px-3.5 py-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <CalendarDays
            className="w-4 h-4 text-blue-600 dark:text-blue-400"
            strokeWidth={2}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            {t("dashboard.upcoming.title", { days: windowDays })}
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">
            {upcoming.length} {t.plural(upcoming.length, "unit.campaign")}
          </div>
        </div>
      </div>
      <ul className="divide-y divide-blue-200/40 dark:divide-blue-900/30">
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
                className="flex items-center gap-2 py-1 text-xs hover:underline"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: u.color }}
                />
                <span className="font-medium truncate flex-1">{u.name}</span>
                <span className="text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {channelCountByCampaign.get(u.id) ?? 0}×{" "}
                  {t("common.channels").toLowerCase()} ·{" "}
                  {t("dashboard.in_days", {
                    n: daysUntil,
                    unit: t.plural(daysUntil, "unit.day"),
                  })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function EndingSoonCard({
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
  const t = await getT();
  if (ending.length === 0) {
    return (
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-3.5 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Clock
              className="w-4 h-4 text-zinc-400 dark:text-zinc-500"
              strokeWidth={2}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {t("dashboard.ending.empty_title")}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t("dashboard.ending.empty_desc", { days: windowDays })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg ring-1 ring-amber-200/70 dark:ring-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Clock
            className="w-4 h-4 text-amber-600 dark:text-amber-400"
            strokeWidth={2}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            {t("dashboard.ending.title", { days: windowDays })}
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">
            {ending.length} {t.plural(ending.length, "unit.campaign")}
          </div>
        </div>
      </div>
      <ul className="divide-y divide-amber-200/40 dark:divide-amber-900/30">
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
                className="flex items-center gap-2 py-1 text-xs hover:underline"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: e.color }}
                />
                <span className="font-medium truncate flex-1">{e.name}</span>
                <span className="text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {channelCountByCampaign.get(e.id) ?? 0}×{" "}
                  {t("common.channels").toLowerCase()} ·{" "}
                  {daysLeft === 0
                    ? t("dashboard.today")
                    : t("dashboard.in_days", {
                        n: daysLeft,
                        unit: t.plural(daysLeft, "unit.day"),
                      })}
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

  // Activity pulse — campaigns + spots created in the last 7 days. The
  // earlier "Top klient" tile was static (single-client agency) so it
  // showed the same string forever; this gives a real cadence signal.
  // count(*) FILTER lets the DB partition by entity in one wire-row.
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const [thisMonthCount, totalCount, recentActivity, awaitingCounts, undeployedSpotsCount] =
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
          campaigns: sql<number>`count(*) FILTER (WHERE ${auditLog.entity} = 'campaign' AND ${auditLog.action} = 'created')::int`,
          spots: sql<number>`count(*) FILTER (WHERE ${auditLog.entity} = 'spot' AND ${auditLog.action} = 'created')::int`,
        })
        .from(auditLog)
        .where(gte(auditLog.createdAt, sevenDaysAgo)),
      // "Awaiting approval" = unapproved campaigns that haven't ended yet,
      // Spots awaiting approval — productionStatus === 'ceka_na_schvaleni'
      // (the explicit "creative is hotová, čeká na Sony" state). After
      // Phase 2c approval is per-spot only; the campaign-level pending
      // count this tile used to compute is gone with that workflow.
      // Split into running/upcoming using whether ANY non-archived
      // campaign deploys this spot with startsAt ≤ today vs in the future.
      db
        .select({
          running: sql<number>`count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM campaign_video cv
            INNER JOIN campaign c ON c.id = cv.campaign_id
            WHERE cv.spot_id = ${spots.id}
              AND c.archived_at IS NULL
              AND c.starts_at <= ${now}
              AND c.ends_at >= ${now}
          ))::int`,
          upcoming: sql<number>`count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM campaign_video cv
            INNER JOIN campaign c ON c.id = cv.campaign_id
            WHERE cv.spot_id = ${spots.id}
              AND c.archived_at IS NULL
              AND c.starts_at > ${now}
          ))::int`,
        })
        .from(spots)
        .where(
          and(
            isNull(spots.archivedAt),
            eq(spots.productionStatus, "ceka_na_schvaleni")
          )
        ),
      // Undeployed spots: not archived, and not currently referenced by
      // any non-archived campaign. Same logic the /spots page uses,
      // just collapsed to a count for the dashboard tile. The NOT EXISTS
      // fragment lives in lib/db/queries.ts so /spots, the drawer and
      // this tile can't drift on the definition of "deployed".
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(spots)
        .where(and(isNull(spots.archivedAt), spotIsUndeployedSql())),
    ]);

  const awaitingRunning = awaitingCounts[0]?.running ?? 0;
  const awaitingUpcoming = awaitingCounts[0]?.upcoming ?? 0;
  const awaitingTotal = awaitingRunning + awaitingUpcoming;

  const t = await getT();
  const localeTag = t.locale === "en" ? "en-US" : "cs-CZ";
  const monthName = monthStart.toLocaleDateString(localeTag, { month: "long" });
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mt-2">
      <StatCard
        label={t("dashboard.stats.total_campaigns")}
        value={totalCount[0].c}
        sub={`${thisMonthCount[0].c} ${t("dashboard.stats.this_month", { month: monthName })}`}
        icon={Play}
        iconTone="emerald"
      />
      <StatCard
        label={t("dashboard.stats.awaiting_approval")}
        value={awaitingTotal}
        sub={
          awaitingTotal === 0
            ? t("dashboard.stats.awaiting_none")
            : awaitingRunning > 0
              ? t("dashboard.stats.awaiting_split", {
                  running: awaitingRunning,
                  upcoming: awaitingUpcoming,
                })
              : t("dashboard.stats.awaiting_upcoming_only", {
                  upcoming: awaitingUpcoming,
                })
        }
        // Click → /spots with the approval=pending filter (already supports
        // it via the existing list filter). Approval is per-spot now, so
        // /spots is the canonical home for "needs attention".
        href={awaitingTotal > 0 ? "/spots?approval=pending" : undefined}
        icon={CheckCircle2}
        iconTone="blue"
      />
      {/* Activity pulse — replaces the previous static "Top klient" tile
          (single-client agency = constant string, no signal). New campaigns
          + spots created in the last 7 days, summed. Tells you whether the
          team's been moving. Click → /admin/audit for the full feed. */}
      <StatCard
        label={t("dashboard.stats.recent_activity")}
        value={
          (recentActivity[0]?.campaigns ?? 0) +
          (recentActivity[0]?.spots ?? 0)
        }
        sub={t("dashboard.stats.recent_activity_sub", {
          campaigns: recentActivity[0]?.campaigns ?? 0,
          spots: recentActivity[0]?.spots ?? 0,
        })}
        icon={Activity}
        iconTone="violet"
      />
      {/* "Undeployed spots" — partner-driven V2 metric. The agency makes
          spots, sometimes forgets to schedule them, this tile is the
          early warning. Links straight to the /spots filter. */}
      <StatCard
        label={t("dashboard.stats.undeployed_spots")}
        value={undeployedSpotsCount[0]?.c ?? 0}
        sub={
          (undeployedSpotsCount[0]?.c ?? 0) === 0
            ? t("dashboard.stats.undeployed_none")
            : t("dashboard.stats.undeployed_sub")
        }
        href={
          (undeployedSpotsCount[0]?.c ?? 0) > 0
            ? "/spots?view=undeployed"
            : undefined
        }
        icon={Megaphone}
        iconTone="pink"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  small,
  href,
  icon,
  iconTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  small?: boolean;
  /** When set, the whole tile becomes a clickable Link to `href`.
   *  Used for tiles where the value drives a page filter (awaiting
   *  approval → /campaigns?approval=pending, undeployed spots →
   *  /spots?view=undeployed). */
  href?: string;
  /** Lucide icon component rendered inside the colored circle on the
   *  left. Keep size consistent (the layout sets w-4 h-4). */
  icon?: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
    fill?: string;
  }>;
  /** Tailwind color tone for the icon circle background + glyph color. */
  iconTone?: "emerald" | "blue" | "violet" | "pink" | "amber" | "zinc";
}) {
  const TONE_BG: Record<NonNullable<typeof iconTone>, string> = {
    emerald: "bg-emerald-100 dark:bg-emerald-900/40",
    blue: "bg-blue-100 dark:bg-blue-900/40",
    violet: "bg-violet-100 dark:bg-violet-900/40",
    pink: "bg-pink-100 dark:bg-pink-900/40",
    amber: "bg-amber-100 dark:bg-amber-900/40",
    zinc: "bg-zinc-100 dark:bg-zinc-800",
  };
  const TONE_FG: Record<NonNullable<typeof iconTone>, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    violet: "text-violet-600 dark:text-violet-400",
    pink: "text-pink-600 dark:text-pink-400",
    amber: "text-amber-600 dark:text-amber-400",
    zinc: "text-zinc-500 dark:text-zinc-400",
  };
  const Icon = icon;
  const tone = iconTone ?? "zinc";

  const inner = (
    <div className="flex items-start gap-3">
      {Icon && (
        <div
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${TONE_BG[tone]}`}
        >
          <Icon className={`w-4 h-4 ${TONE_FG[tone]}`} strokeWidth={2} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
          {label}
        </div>
        <div
          className={
            (small ? "text-sm " : "text-xl ") + "font-semibold truncate"
          }
          title={String(value)}
        >
          {value}
        </div>
        {sub && (
          <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
  const baseClass =
    "rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm px-3.5 py-3";
  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} block transition-shadow hover:shadow-md hover:ring-zinc-300 dark:hover:ring-zinc-700`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}
