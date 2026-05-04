// Intercepting route: when the user clicks a bar on the timeline (or a row
// on /campaigns), the bar's `router.push("/campaigns/<id>")` is caught
// here and rendered as a right-side peek panel instead of replacing the
// underlying page. Direct URL hits (refresh, deep link, middle-click) still
// fall through to app/campaigns/[id]/page.tsx as the full detail page.
//
// The panel is intentionally a *condensed* view: enough to triage and act
// on (see channels, last comments, take quick actions), but not the full
// detail. "Otevřít detail" / "Open detail" inside the panel is a regular
// <a href> (NOT a Next Link) so it bypasses the intercept and gives the
// user the full page when they want to dig in.

import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, desc } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  channels,
  countries,
  chains,
  products,
  comments,
  users,
} from "@/lib/db/client";
import { kindEmoji, kindLabel } from "@/lib/products";
import {
  formatDate,
  daysBetween,
  computedRunState,
  formatRelative,
} from "@/lib/utils";
import {
  cancelCampaign,
  reactivateCampaign,
  cloneCampaign,
  archiveCampaign,
} from "@/app/campaigns/[id]/actions";
import { StatusBadge } from "@/components/status-badge";
import { CommunicationBadge } from "@/components/communication-badge";
import { SidePanel } from "@/components/side-panel";
import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";

export default async function CampaignPeekPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [row] = await db
    .select({ campaign: campaigns, product: products })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) notFound();

  const channelRows = await db
    .select({
      countryCode: countries.code,
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

  const videoRows = await db
    .select({
      countryName: countries.name,
      countryCode: countries.code,
      countryFlag: countries.flagEmoji,
      videoUrl: campaignVideos.videoUrl,
    })
    .from(campaignVideos)
    .innerJoin(countries, eq(campaignVideos.countryId, countries.id))
    .where(eq(campaignVideos.campaignId, campaignId))
    .orderBy(asc(countries.sortOrder));

  // Last 3 comments — the rest is a "view all in detail" hop.
  const recentComments = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.campaignId, campaignId))
    .orderBy(desc(comments.createdAt))
    .limit(3);
  const totalCommentRow = await db
    .select({ c: campaignChannels.campaignId })
    .from(comments)
    .where(eq(comments.campaignId, campaignId));
  const totalComments = totalCommentRow.length;

  const c = row.campaign;
  const product = row.product;
  const runState = computedRunState(c);
  const dur = daysBetween(c.startsAt, c.endsAt);
  const t = await getT();

  return (
    <SidePanel
      title={c.name}
      subtitle={
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
            style={{ background: c.color }}
            aria-hidden
          />
          <StatusBadge status={c.status} runState={runState} />
          <CommunicationBadge type={c.communicationType} />
          {c.client && (
            <span className="text-xs text-zinc-500">{c.client}</span>
          )}
        </div>
      }
      footer={
        <>
          {/* Plain <a> so we BYPASS the interceptor and load the real detail
              page (the panel is a peek; "Otevřít detail" is the explicit
              hop to the full experience). */}
          <a
            href={`/campaigns/${campaignId}`}
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
          >
            {t("ctx.open_detail")}
          </a>
          <Link
            href={`/campaigns/${campaignId}/edit`}
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {t("detail.edit")}
          </Link>
          <form
            action={async () => {
              "use server";
              await cloneCampaign(campaignId);
            }}
          >
            <button
              type="submit"
              className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {t("detail.clone")}
            </button>
          </form>
          <span className="ml-auto" />
          {c.status !== "cancelled" ? (
            <form
              action={async () => {
                "use server";
                await cancelCampaign(campaignId);
              }}
            >
              <button
                type="submit"
                className="text-sm px-2 py-1 text-amber-700 hover:underline"
                title={t("detail.cancel_historic")}
              >
                {t("detail.cancel_historic")}
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await reactivateCampaign(campaignId);
              }}
            >
              <button
                type="submit"
                className="text-sm px-2 py-1 text-emerald-700 hover:underline"
              >
                {t("detail.reactivate")}
              </button>
            </form>
          )}
          <form
            action={async () => {
              "use server";
              await archiveCampaign(campaignId);
            }}
          >
            <button
              type="submit"
              className="text-sm px-2 py-1 text-red-600 hover:underline"
              title={t("detail.archive_tooltip")}
            >
              {t("detail.archive")}
            </button>
          </form>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Term + duration */}
        <Block label={t("common.start") + " – " + t("common.end")}>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {dur} {t.plural(dur, "unit.day")}
          </div>
        </Block>

        {/* Product */}
        {product && (
          <Block label={t("detail.product_section")}>
            <div className="flex items-start gap-3">
              {product.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.coverUrl}
                  alt=""
                  className="w-12 h-16 object-cover rounded ring-1 ring-zinc-200 dark:ring-zinc-800 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 flex-wrap">
                  {product.name}
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400 font-normal">
                    <span aria-hidden>{kindEmoji(product.kind)}</span>
                    {kindLabel(product.kind)}
                  </span>
                </div>
                {product.releaseDate && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {t("detail.product_released", {
                      date: formatDate(product.releaseDate),
                    })}
                  </div>
                )}
                {product.summary && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                    {product.summary}
                  </p>
                )}
              </div>
            </div>
          </Block>
        )}

        {/* Per-country videos */}
        {videoRows.length > 0 && (
          <Block label={t("detail.videos_section")}>
            <ul className="space-y-1.5">
              {videoRows.map((v) => (
                <li
                  key={v.countryCode}
                  className="flex items-center gap-2 text-xs"
                >
                  <span aria-hidden>{v.countryFlag}</span>
                  <span className="font-medium w-12 shrink-0">
                    {v.countryCode}
                  </span>
                  <a
                    href={v.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                  >
                    {v.videoUrl}
                  </a>
                  <a
                    href={v.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Play"
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 9 9"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M1.5 0.5l6.5 4-6.5 4z" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {/* Channels */}
        <Block
          label={`${t("detail.channels_section")} (${channelRows.length})`}
        >
          <div className="flex flex-wrap gap-1.5">
            {channelRows.map((ch, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs"
              >
                <span aria-hidden>{ch.countryFlag}</span>
                <span className="text-zinc-500">
                  {localizedCountryName(
                    ch.countryCode,
                    ch.countryName,
                    t.locale
                  )}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>{ch.chainName}</span>
              </span>
            ))}
          </div>
        </Block>

        {/* Tags */}
        {c.tags && c.tags.length > 0 && (
          <Block label={t("common.tags")}>
            <div className="flex flex-wrap gap-1">
              {c.tags.map((tg) => (
                <span
                  key={tg}
                  className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300"
                >
                  #{tg}
                </span>
              ))}
            </div>
          </Block>
        )}

        {/* Notes */}
        {c.notes && (
          <Block label={t("detail.notes_section")}>
            <p className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 line-clamp-6">
              {c.notes}
            </p>
          </Block>
        )}

        {/* Last comments */}
        {totalComments > 0 && (
          <Block
            label={`${t("detail.comments_section")} (${totalComments})`}
            action={
              <a
                href={`/campaigns/${campaignId}#comments`}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("ctx.open_detail")}
              </a>
            }
          >
            <ul className="space-y-2">
              {recentComments.map((cm) => (
                <li
                  key={cm.id}
                  className="rounded-md bg-zinc-50 dark:bg-zinc-950/40 px-2.5 py-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium">
                      {cm.userName ??
                        cm.userEmail ??
                        t("detail.deleted_user")}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {formatRelative(cm.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 line-clamp-3">
                    {cm.body}
                  </p>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </div>
    </SidePanel>
  );
}

function Block({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <h3 className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">
          {label}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}
