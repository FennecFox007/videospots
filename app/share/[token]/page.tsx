// Public read-only campaign view. Reachable via /share/<token> without login.
// Token is checked against the share_link table; expired/missing tokens 404.

import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, asc, gt, isNull, or } from "drizzle-orm";
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
} from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

type SharePayload =
  | { type: "campaign"; campaignId: number }
  | { type: "timeline"; from?: string; to?: string };

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
        // Expiry is optional; null = forever.
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now))!
      )
    )
    .limit(1);

  if (!link) notFound();

  const payload = link.payload as SharePayload;
  if (payload.type !== "campaign") notFound();

  const [row] = await db
    .select({ campaign: campaigns, game: games })
    .from(campaigns)
    .leftJoin(games, eq(campaigns.gameId, games.id))
    .where(eq(campaigns.id, payload.campaignId))
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
    .where(eq(campaignChannels.campaignId, payload.campaignId))
    .orderBy(asc(countries.sortOrder), asc(chains.sortOrder));

  const c = row.campaign;
  const game = row.game;
  const runState = computedRunState(c);
  const dur = daysBetween(c.startsAt, c.endsAt);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            videospots
          </span>
          <span className="text-xs text-zinc-500">Veřejný náhled kampaně</span>
        </div>
      </div>

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

        <p className="text-xs text-zinc-500 text-center pt-4">
          Tento odkaz je platný do {link.expiresAt ? formatDate(link.expiresAt) : "—"}.{" "}
          <Link href="/" className="underline">
            Otevřít aplikaci
          </Link>
        </p>
      </div>
    </div>
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
