// Public read-only views. Two payload types are supported on the same /share/<token>
// route:
//   - { type: "campaign", campaignId } — single campaign brief
//   - { type: "timeline", filters }    — full timeline snapshot at a saved
//                                         filter/range state
// No login required; expired tokens 404.

import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, asc, gt, isNull, or, inArray } from "drizzle-orm";
import {
  db,
  shareLinks,
  campaigns,
  campaignChannels,
  channels,
  countries,
  chains,
  games,
} from "@/lib/db/client";
import {
  formatDate,
  daysBetween,
  pluralCs,
  computedRunState,
  addDays,
  snapToMondayStart,
} from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import {
  PublicTimeline,
  type PublicCountryGroup,
} from "@/components/public-timeline";
import {
  findCampaignIds,
  fetchTimelineCampaigns,
} from "@/lib/db/queries";

type SharePayload =
  | { type: "campaign"; campaignId: number }
  | { type: "timeline"; filters?: Record<string, string> };

const DEFAULT_RANGE_DAYS = 35;

function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isFinite(d.getTime()) ? d : null;
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const now = new Date();
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now))!
      )
    )
    .limit(1);
  if (!link) notFound();

  const payload = link.payload as SharePayload;

  if (payload.type === "campaign") {
    return <CampaignSharePage campaignId={payload.campaignId} link={link} />;
  }
  if (payload.type === "timeline") {
    return (
      <TimelineSharePage
        filters={payload.filters ?? {}}
        link={link}
        now={now}
      />
    );
  }

  notFound();
}

// ---------------------------------------------------------------------------
// Single campaign view (existing behavior, kept identical)
// ---------------------------------------------------------------------------

async function CampaignSharePage({
  campaignId,
  link,
}: {
  campaignId: number;
  link: { expiresAt: Date | null };
}) {
  const [row] = await db
    .select({ campaign: campaigns, game: games })
    .from(campaigns)
    .leftJoin(games, eq(campaigns.gameId, games.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) notFound();

  const channelRows = await db
    .select({
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      chainName: chains.name,
    })
    .from(campaignChannels)
    .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id))
    .where(eq(campaignChannels.campaignId, campaignId))
    .orderBy(asc(countries.sortOrder), asc(chains.sortOrder));

  const c = row.campaign;
  const game = row.game;
  const runState = computedRunState(c);
  const dur = daysBetween(c.startsAt, c.endsAt);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <PublicHeader subtitle="Veřejný náhled kampaně" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-block w-4 h-4 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800"
              style={{ background: c.color }}
            />
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <StatusBadge status={c.status} runState={runState} />
          </div>
          {c.client && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {c.client}
            </p>
          )}
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card label="Začátek">{formatDate(c.startsAt)}</Card>
          <Card label="Konec">{formatDate(c.endsAt)}</Card>
          <Card label="Délka">
            {dur} {pluralCs(dur, "den", "dny", "dní")}
          </Card>
        </div>

        {game && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium mb-3">Hra</h2>
            <div className="flex items-start gap-4">
              {game.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.coverUrl}
                  alt={game.name}
                  className="w-24 h-32 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{game.name}</div>
                {game.releaseDate && (
                  <div className="text-sm text-zinc-500 mt-0.5">
                    Vyšlo {formatDate(game.releaseDate)}
                  </div>
                )}
                {game.summary && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                    {game.summary}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {c.videoUrl && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="font-medium mb-3">Video</h2>
            <VideoEmbed url={c.videoUrl} />
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="font-medium mb-3">Kanály ({channelRows.length})</h2>
          <div className="flex flex-wrap gap-2">
            {channelRows.map((ch, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-sm"
              >
                <span>{ch.countryFlag}</span>
                <span className="text-zinc-500">{ch.countryName}</span>
                <span>·</span>
                <span>{ch.chainName}</span>
              </span>
            ))}
          </div>
        </div>

        <PublicFooter expiresAt={link.expiresAt} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Whole-timeline view (new)
// ---------------------------------------------------------------------------

async function TimelineSharePage({
  filters,
  link,
  now,
}: {
  filters: Record<string, string>;
  link: { expiresAt: Date | null };
  now: Date;
}) {
  const fromParam = parseDateParam(filters.from);
  const toParam = parseDateParam(filters.to);
  const rangeStart =
    fromParam ?? snapToMondayStart(addDays(new Date(), -7));
  const rangeEnd =
    toParam && toParam > rangeStart
      ? toParam
      : addDays(rangeStart, DEFAULT_RANGE_DAYS);

  // Channels — always all of them (so the public viewer sees the full grid,
  // including empty rows). Filters are about which campaigns appear.
  const channelRows = await db
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

  const groupMap = new Map<number, PublicCountryGroup>();
  for (const r of channelRows) {
    if (!groupMap.has(r.countryId)) {
      groupMap.set(r.countryId, {
        id: r.countryId,
        name: r.countryName,
        flag: r.countryFlag,
        channels: [],
      });
    }
    groupMap.get(r.countryId)!.channels.push({
      id: r.channelId,
      chainName: r.chainName,
    });
  }
  const groups = Array.from(groupMap.values());

  // Campaigns matching the saved filters within the saved range.
  const ids = await findCampaignIds({
    q: filters.q,
    countryCode: filters.country,
    chainCode: filters.chain,
    client: filters.client,
    status: filters.status,
    runState: filters.runState,
    tag: filters.tag,
    rangeStart,
    rangeEnd,
  });
  const campaignRows = await fetchTimelineCampaigns(
    ids,
    rangeStart,
    rangeEnd
  );

  const distinct = new Set(campaignRows.map((c) => c.campaignId)).size;

  const activeFilters = describeFilters(filters);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <PublicHeader subtitle="Veřejný náhled timeline" />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Plán kampaní
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {formatDate(rangeStart)} – {formatDate(addDays(rangeEnd, -1))} ·{" "}
            {distinct}{" "}
            {pluralCs(distinct, "kampaň", "kampaně", "kampaní")} ·{" "}
            {channelRows.length} kanálů
          </p>
          {activeFilters.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              Filtr: {activeFilters.join(" · ")}
            </p>
          )}
        </div>

        <PublicTimeline
          groups={groups}
          campaigns={campaignRows}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          now={now}
        />

        <PublicFooter expiresAt={link.expiresAt} />
      </div>
    </div>
  );
}

function describeFilters(f: Record<string, string>): string[] {
  const out: string[] = [];
  if (f.q) out.push(`hledání: "${f.q}"`);
  if (f.country) out.push(`stát: ${f.country}`);
  if (f.chain) out.push(`řetězec: ${f.chain}`);
  if (f.client) out.push(`klient: ${f.client}`);
  if (f.runState) out.push(`stav: ${f.runState}`);
  if (f.tag) out.push(`štítek: ${f.tag}`);
  return out;
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function PublicHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          videospots
        </span>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
    </div>
  );
}

function PublicFooter({ expiresAt }: { expiresAt: Date | null }) {
  return (
    <p className="text-xs text-zinc-500 text-center pt-4">
      Tento odkaz je platný do {expiresAt ? formatDate(expiresAt) : "—"}.{" "}
      <Link href="/" className="underline">
        Otevřít aplikaci
      </Link>
    </p>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <div className="text-base font-medium">{children}</div>
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/
  );
  const vimeo = url.match(/vimeo\.com\/(\d+)/);

  if (yt) {
    return (
      <div className="aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${yt[1]}`}
          className="w-full h-full rounded"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (vimeo) {
    return (
      <div className="aspect-video">
        <iframe
          src={`https://player.vimeo.com/video/${vimeo[1]}`}
          className="w-full h-full rounded"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) {
    return (
      <video src={url} controls className="w-full rounded aspect-video" />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline break-all"
    >
      {url}
    </a>
  );
}
