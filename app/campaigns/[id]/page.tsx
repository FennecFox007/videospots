import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { and, eq, asc, desc, sql } from "drizzle-orm";
import {
  db,
  campaigns,
  campaignChannels,
  campaignVideos,
  spots,
  channels,
  countries,
  chains,
  products,
  comments,
  users,
  auditLog,
  shareLinks,
} from "@/lib/db/client";
import { alias } from "drizzle-orm/pg-core";
import { kindLabel, kindEmoji } from "@/lib/products";
import { auth } from "@/auth";
import {
  formatDate,
  daysBetween,
  computedRunState,
  formatRelative,
} from "@/lib/utils";
import {
  archiveCampaign,
  cloneCampaign,
  cancelCampaign,
  reactivateCampaign,
  addComment,
  deleteComment,
  approveCampaign,
  clearCampaignApproval,
} from "./actions";
import { StatusBadge } from "@/components/status-badge";
import { ShareButton } from "@/components/share-button";
import { SaveAsTemplateButton } from "@/components/save-as-template-button";
import { EditableCampaignTitle } from "@/components/editable-campaign-title";
import { CommunicationBadge } from "@/components/communication-badge";
import { CountryBadge } from "@/components/country-badge";
import {
  CampaignShareLinks,
  type CampaignShareLinkRow,
} from "@/components/campaign-share-links";
import { VideoEmbed } from "@/components/video-embed";
import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const [row] = await db
    .select({
      campaign: campaigns,
      product: products,
      approvedByName: users.name,
      approvedByEmail: users.email,
    })
    .from(campaigns)
    .leftJoin(products, eq(campaigns.productId, products.id))
    .leftJoin(users, eq(campaigns.approvedById, users.id))
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

  // One row per distinct country the campaign runs in. Left-joined so
  // countries without a yet-assigned spot come back with videoUrl=null —
  // the detail page renders both states (play link if assigned, "spot
  // pending" if not). Lets the user plan campaigns months ahead and
  // attach spots once production delivers them.
  const videoRows = await db
    .selectDistinct({
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      countryCode: countries.code,
      videoUrl: spots.videoUrl,
      spotName: spots.name,
      countrySortOrder: countries.sortOrder,
    })
    .from(campaignChannels)
    .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .leftJoin(
      campaignVideos,
      and(
        eq(campaignVideos.campaignId, campaignId),
        eq(campaignVideos.countryId, countries.id)
      )
    )
    .leftJoin(spots, eq(campaignVideos.spotId, spots.id))
    .where(eq(campaignChannels.campaignId, campaignId))
    .orderBy(asc(countries.sortOrder));

  const c = row.campaign;
  const product = row.product;
  const runState = computedRunState(c);

  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  const commentRows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.campaignId, campaignId))
    .orderBy(asc(comments.createdAt));

  const historyRows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      changes: auditLog.changes,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(
      and(eq(auditLog.entity, "campaign"), eq(auditLog.entityId, campaignId))
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(50);

  // Active + recently-revoked/expired share links for this campaign. We
  // double-join `users` (creator + revoker), so they need distinct aliases.
  // The component expects ALL links (it segments active vs inactive client-
  // side under a collapsed <details>); 20 is a generous cap to keep the
  // payload small even on a heavily-shared campaign.
  const shareCreatedBy = alias(users, "share_created_by");
  const shareRevokedBy = alias(users, "share_revoked_by");
  const shareLinkRows: CampaignShareLinkRow[] = await db
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      label: shareLinks.label,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      revokedByName: shareRevokedBy.name,
      createdAt: shareLinks.createdAt,
      createdByName: shareCreatedBy.name,
    })
    .from(shareLinks)
    .leftJoin(shareCreatedBy, eq(shareLinks.createdById, shareCreatedBy.id))
    .leftJoin(shareRevokedBy, eq(shareLinks.revokedById, shareRevokedBy.id))
    .where(
      // JSONB filter: payload->>'type' = 'campaign' AND
      // (payload->>'campaignId')::int = id. Guards against the (currently
      // impossible, but cheap to defend) case of a timeline link with a
      // numeric collision in payload.
      and(
        sql`${shareLinks.payload}->>'type' = 'campaign'`,
        sql`(${shareLinks.payload}->>'campaignId')::int = ${campaignId}`
      )
    )
    .orderBy(desc(shareLinks.createdAt))
    .limit(20);

  // Origin used to render absolute /share/<token> URLs in the management
  // list. Server-rendered so the rows have copyable URLs even before any
  // client-side window.location is read.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  // List of usernames/emails for @mention highlighting in comments.
  const knownHandles = await db
    .selectDistinct({ name: users.name, email: users.email })
    .from(users);

  const t = await getT();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {t("detail.back_to_timeline")}
          </Link>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span
              className="inline-block w-4 h-4 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-800"
              style={{ background: c.color }}
              aria-label={t("common.color")}
            />
            <EditableCampaignTitle
              campaignId={campaignId}
              initialName={c.name}
            />
            <StatusBadge status={c.status} runState={runState} />
            <CommunicationBadge type={c.communicationType} />
            {/* Approval is auth-gated — anyone signed in can approve or
                un-approve via these buttons. The same action is exposed
                in the bar context menu and peek footer; these two are
                the canonical home. */}
            {c.clientApprovedAt ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3 8.5 L7 12 L13 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t("approval.approved_on", {
                    date: formatDate(c.clientApprovedAt),
                  })}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await clearCampaignApproval(campaignId);
                  }}
                >
                  <button
                    type="submit"
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
                  >
                    {t("approval.unapprove")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {t("approval.waiting")}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await approveCampaign(campaignId);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    {t("approval.approve")}
                  </button>
                </form>
              </>
            )}
          </div>
          {c.clientApprovedAt && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 max-w-xl">
              {t("approval.approved_by", {
                who:
                  row.approvedByName ?? row.approvedByEmail ?? t("detail.deleted_user"),
              })}
              {c.clientApprovedComment && (
                <>
                  {" — "}
                  <span className="italic">
                    &ldquo;{c.clientApprovedComment}&rdquo;
                  </span>
                </>
              )}
            </p>
          )}
          {c.client && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {c.client}
            </p>
          )}
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.tags.map((tg) => (
                <Link
                  key={tg}
                  href={`/campaigns?tag=${encodeURIComponent(tg)}`}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  #{tg}
                </Link>
              ))}
            </div>
          )}
          {c.notes && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 italic max-w-2xl line-clamp-3 whitespace-pre-wrap">
              {c.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {c.status !== "cancelled" ? (
            <form
              action={async () => {
                "use server";
                await cancelCampaign(campaignId);
              }}
            >
              <button
                type="submit"
                className="text-sm px-3 py-1.5 border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30"
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
                className="text-sm px-3 py-1.5 border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                {t("detail.reactivate")}
              </button>
            </form>
          )}
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
          <ShareButton campaignId={campaignId} />
          <SaveAsTemplateButton
            campaignId={campaignId}
            defaultName={c.name}
          />
          <a
            href={`/print/campaigns/${campaignId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
            title={t("detail.print")}
          >
            {t("detail.print")}
          </a>
          <form
            action={async () => {
              "use server";
              await archiveCampaign(campaignId);
            }}
          >
            <button
              type="submit"
              className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 dark:border-red-900/50 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
              title={t("detail.archive_tooltip")}
            >
              {t("detail.archive")}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card label={t("common.start")}>{formatDate(c.startsAt)}</Card>
        <Card label={t("common.end")}>{formatDate(c.endsAt)}</Card>
        <Card label={t("common.duration")}>
          {(() => {
            const d = daysBetween(c.startsAt, c.endsAt);
            return `${d} ${t.plural(d, "unit.day")}`;
          })()}
        </Card>
        <Card label={t("detail.total_reach")}>
          {(() => {
            const d = daysBetween(c.startsAt, c.endsAt);
            const sd = d * channelRows.length;
            return (
              <span>
                {sd}{" "}
                <span className="text-xs text-zinc-500 font-normal">
                  {t("detail.screen_days")} · {channelRows.length} ×{" "}
                  {t.plural(d, "unit.day")}
                </span>
              </span>
            );
          })()}
        </Card>
      </div>

      {product && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
          <h2 className="font-medium mb-3">{t("detail.product_section")}</h2>
          <div className="flex items-start gap-4">
            {product.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.coverUrl}
                alt={product.name}
                className="w-24 h-32 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{product.name}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <span aria-hidden>{kindEmoji(product.kind)}</span>
                  {kindLabel(product.kind)}
                </span>
              </div>
              {product.releaseDate && (
                <div className="text-sm text-zinc-500 mt-0.5">
                  {t("detail.product_released", {
                    date: formatDate(product.releaseDate),
                  })}
                </div>
              )}
              {product.summary && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                  {product.summary}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {videoRows.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 space-y-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-medium">
              {t("detail.videos_section")} (
              {videoRows.filter((v) => v.videoUrl).length}/{videoRows.length})
            </h2>
            {videoRows.some((v) => !v.videoUrl) && (
              <Link
                href={`/campaigns/${campaignId}/edit`}
                className="text-sm text-blue-600 hover:underline"
              >
                {t("detail.assign_spots")}
              </Link>
            )}
          </div>
          {videoRows.map((v) => (
            <div key={v.countryCode}>
              <div className="flex items-center gap-2 mb-2">
                <CountryBadge
                  code={v.countryCode}
                  flag={v.countryFlag}
                  size="sm"
                />
                <span className="text-sm font-medium">{v.countryName}</span>
                <span className="text-xs text-zinc-500 font-mono uppercase">
                  {v.countryCode}
                </span>
                {v.spotName && (
                  <span className="text-xs text-zinc-500 italic">
                    · {v.spotName}
                  </span>
                )}
              </div>
              {v.videoUrl ? (
                <VideoEmbed url={v.videoUrl} />
              ) : (
                <div className="rounded-md border-2 border-dashed border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-6 text-sm text-amber-800 dark:text-amber-300">
                  {t("detail.spot_pending")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          {t("detail.channels_section")} ({channelRows.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {channelRows.map((ch, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-sm"
            >
              <CountryBadge
                code={ch.countryCode}
                flag={ch.countryFlag}
                size="xs"
              />
              <span className="text-zinc-500">
                {localizedCountryName(ch.countryCode, ch.countryName, t.locale)}
              </span>
              <span>·</span>
              <span>{ch.chainName}</span>
            </span>
          ))}
          {channelRows.length === 0 && (
            <p className="text-sm text-zinc-500">{t("detail.no_channels")}</p>
          )}
        </div>
      </div>

      {c.notes && (
        <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
          <h2 className="font-medium mb-2">{t("detail.notes_section")}</h2>
          <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {c.notes}
          </p>
        </div>
      )}

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          {t("share_links.section_title")}{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({shareLinkRows.filter((r) => !r.revokedAt && (!r.expiresAt || r.expiresAt > new Date())).length})
          </span>
        </h2>
        <CampaignShareLinks rows={shareLinkRows} origin={origin} />
      </div>

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          {t("detail.comments_section")} ({commentRows.length})
        </h2>

        {commentRows.length > 0 && (
          <ul className="space-y-3 mb-4">
            {commentRows.map((cm) => (
              <li
                key={cm.id}
                className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {cm.userName ?? cm.userEmail ?? t("detail.deleted_user")}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatRelative(cm.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {renderCommentBody(cm.body, knownHandles)}
                </p>
                {cm.userId === currentUserId && (
                  <form
                    action={async () => {
                      "use server";
                      await deleteComment(cm.id);
                    }}
                    className="mt-1"
                  >
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-red-600"
                    >
                      {t("common.delete")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={addComment.bind(null, campaignId)} className="space-y-2">
          <textarea
            name="body"
            required
            rows={2}
            maxLength={2000}
            placeholder={t("detail.comments_placeholder")}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
            >
              {t("detail.comments_submit")}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="font-medium mb-3">
          {t("detail.history_section")} ({historyRows.length})
        </h2>
        {historyRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("detail.no_history")}</p>
        ) : (
          <ul className="space-y-1.5">
            {historyRows.map((h) => (
              <li
                key={h.id}
                className="text-sm text-zinc-600 dark:text-zinc-400 flex items-baseline gap-2 flex-wrap"
              >
                <span className="text-xs text-zinc-500 w-24 shrink-0">
                  {formatRelative(h.createdAt)}
                </span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {h.userName ?? h.userEmail ?? "?"}
                </span>
                <span className="leading-snug">
                  {humanizeAuditEntry(h.action, h.changes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Render a single audit-log entry as a Czech sentence. Handles two storage
 * shapes side by side, since we changed the format and old rows still live in
 * the DB:
 *
 * - **Diff** (newer): `{ name: { from: "X", to: "Y" }, … }` — render as
 *   "upravil(a) — název X → Y, kanálů 6 → 7".
 * - **Snapshot** (older): `{ name: "X", channelCount: 6 }` — flat values,
 *   render as "upravil(a) — kampaň 'X', 6 kanálů".
 *
 * Special-case shapes from the various server actions (drag-channel,
 * timeline-drag, rename, reactivate, clone, etc.) are detected first so the
 * sentence stays short.
 */
function humanizeAuditEntry(action: string, changes: unknown): React.ReactNode {
  const obj =
    changes && typeof changes === "object"
      ? (changes as Record<string, unknown>)
      : null;

  // Action-led summaries — these have no useful detail beyond the verb.
  if (action === "cancelled") return "zrušil(a) kampaň";
  if (action === "archived") return "archivoval(a) kampaň";
  if (action === "approved") {
    // approveCampaign writes { note: string | null }. If the user added a
    // note when approving, show it inline so the audit log captures intent.
    const note =
      obj && typeof obj.note === "string" && obj.note.trim().length > 0
        ? obj.note.trim()
        : null;
    return note ? (
      <>
        schválil(a) kampaň{" "}
        <span className="text-zinc-500">— „{note}"</span>
      </>
    ) : (
      "schválil(a) kampaň"
    );
  }
  if (action === "deleted") {
    const name = obj && typeof obj.name === "string" ? obj.name : null;
    return name ? (
      <>smazal(a) kampaň „{name}"</>
    ) : (
      "smazal(a) kampaň"
    );
  }

  if (action === "created") {
    if (obj && typeof obj.clonedFrom === "number") {
      return <>vytvořil(a) kampaň naklonováním z #{obj.clonedFrom}</>;
    }
    if (obj && typeof obj.series === "string") {
      return <>vytvořil(a) kampaň (série {String(obj.series)})</>;
    }
    return "vytvořil(a) kampaň";
  }

  // Specific edit shapes
  if (obj && obj.via === "timeline-drag-channel") {
    const from = obj.from;
    const to = obj.to;
    return (
      <>
        přesunul(a) kampaň na jiný kanál
        {typeof from === "number" && typeof to === "number" && (
          <span className="text-xs text-zinc-500 ml-1">
            (#{from} → #{to})
          </span>
        )}
      </>
    );
  }
  if (obj && obj.unarchived === true) return "obnovil(a) z archivu";
  if (obj && obj.reactivated === true) return "obnovil(a) zrušenou kampaň";
  if (obj && obj.approvalCleared === true) return "zrušil(a) schválení";
  // Per-retailer override edits — channel-level, kept distinct from the
  // master campaign edits. The override action body lives in setChannelOverride
  // and clearChannelOverride; both write a small {channelOverride|channelOverrideCleared}
  // payload that the generic-update path doesn't recognise.
  if (obj && obj.channelOverride && typeof obj.channelOverride === "object") {
    return "upravil(a) přepsání pro řetězec";
  }
  if (obj && obj.channelOverrideCleared) {
    return "smazal(a) přepsání pro řetězec";
  }
  if (obj && obj.renamed && isDiff(obj.renamed)) {
    return (
      <>
        přejmenoval(a) z „{String(obj.renamed.from)}" na „
        {String(obj.renamed.to)}"
      </>
    );
  }

  // Generic update — walk the change object, building a list of
  // "field: from → to" or "field: value" depending on shape.
  if (action === "updated" && obj) {
    const parts: React.ReactNode[] = [];
    let key = 0;
    for (const [field, value] of Object.entries(obj)) {
      if (field === "via") continue; // skip metadata keys
      const label = AUDIT_FIELD_LABEL[field];
      if (!label) continue; // unknown key — skip rather than render gibberish
      if (isDiff(value)) {
        parts.push(
          <span key={key++} className="whitespace-nowrap">
            {label}: {formatAuditValue(field, value.from)}{" "}
            <span className="text-zinc-400">→</span>{" "}
            {formatAuditValue(field, value.to)}
          </span>
        );
      } else {
        parts.push(
          <span key={key++} className="whitespace-nowrap">
            {label}: {formatAuditValue(field, value)}
          </span>
        );
      }
    }
    if (parts.length === 0) return "upravil(a) kampaň";
    const joined: React.ReactNode[] = [];
    parts.forEach((p, i) => {
      if (i > 0) joined.push(<span key={`sep-${i}`}>, </span>);
      joined.push(p);
    });
    return (
      <>
        upravil(a) — <span className="text-zinc-500">{joined}</span>
      </>
    );
  }

  return action;
}

const AUDIT_FIELD_LABEL: Record<string, string> = {
  name: "název",
  client: "klient",
  videoUrl: "video", // legacy
  videos: "videa",
  color: "barva",
  status: "stav",
  communicationType: "typ",
  notes: "poznámka",
  tags: "štítky",
  startsAt: "začátek",
  endsAt: "konec",
  productName: "produkt",
  channels: "kanály",
  channelCount: "kanálů",
};

function isDiff(v: unknown): v is { from: unknown; to: unknown } {
  return (
    !!v &&
    typeof v === "object" &&
    "from" in (v as object) &&
    "to" in (v as object)
  );
}

function formatAuditValue(field: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-zinc-400 italic">—</span>;
  }
  if (field === "startsAt" || field === "endsAt") {
    if (value instanceof Date) return formatDate(value);
    if (typeof value === "string") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return formatDate(d);
    }
  }
  if (field === "status") {
    return value === "approved"
      ? "Aktivní"
      : value === "cancelled"
        ? "Zrušeno"
        : String(value);
  }
  if (field === "tags" && Array.isArray(value)) {
    return value.length === 0 ? (
      <span className="text-zinc-400 italic">žádné</span>
    ) : (
      value.map((t) => `#${t}`).join(", ")
    );
  }
  if (field === "channels" && Array.isArray(value)) {
    return `${value.length} kanálů`;
  }
  if (field === "videos" && Array.isArray(value)) {
    return value.length === 0
      ? "žádné"
      : `${value.length} ${value.length === 1 ? "země" : value.length <= 4 ? "země" : "zemí"}`;
  }
  if (field === "color" && typeof value === "string") {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block w-2 h-2 rounded-full ring-1 ring-zinc-300 dark:ring-zinc-600"
          style={{ background: value }}
        />
        <span className="font-mono text-[10px]">{value}</span>
      </span>
    );
  }
  if (typeof value === "string") {
    if (value.length > 40) return `„${value.slice(0, 39)}…"`;
    return `„${value}"`;
  }
  return String(value);
}

/**
 * Render comment body with @mentions visually highlighted. Mentions match a
 * known username or email (substring before @, or the whole label) — anything
 * else stays plain text.
 */
function renderCommentBody(
  body: string,
  knownHandles: { name: string | null; email: string }[]
): React.ReactNode {
  const handleSet = new Set<string>();
  for (const h of knownHandles) {
    if (h.email) handleSet.add(h.email.toLowerCase());
    if (h.name) handleSet.add(h.name.toLowerCase());
    // also bare local-part of email ("petr@firma.cz" → "petr")
    const local = h.email?.split("@")[0]?.toLowerCase();
    if (local) handleSet.add(local);
  }
  // Tokenize on @ followed by non-whitespace.
  const re = /(@[\w.\-]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    const handle = match[1].slice(1).toLowerCase();
    const known = handleSet.has(handle);
    parts.push(
      <span
        key={`m-${i++}`}
        className={
          known
            ? "rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-1 font-medium"
            : "text-zinc-500"
        }
      >
        {match[1]}
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts;
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
        {label}
      </div>
      <div className="text-base font-medium">{children}</div>
    </div>
  );
}

