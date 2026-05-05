import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  db,
  spots,
  products,
  campaigns,
  campaignVideos,
  countries,
  users,
  auditLog,
} from "@/lib/db/client";
import { SpotFormBody } from "@/components/spot-form-body";
import {
  updateSpot,
  archiveSpot,
  unarchiveSpot,
  deleteSpot,
} from "@/app/spots/actions";
import { VideoEmbed } from "@/components/video-embed";
import { getT } from "@/lib/i18n/server";
import { localizedCountryName } from "@/lib/i18n/country";
import { formatDate } from "@/lib/utils";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { SpotApprovalActions } from "@/components/spot-approval-actions";
import {
  spotApprovalState,
  spotApprovalTone,
  spotApprovalLabelKey,
} from "@/lib/spot-approval";

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spotId = Number(id);
  if (!Number.isFinite(spotId)) notFound();

  const [row] = await db
    .select({
      spot: spots,
      productName: products.name,
      productKind: products.kind,
      countryCode: countries.code,
      countryName: countries.name,
      countryFlag: countries.flagEmoji,
      approvedByName: users.name,
      approvedByEmail: users.email,
    })
    .from(spots)
    .leftJoin(products, eq(spots.productId, products.id))
    .innerJoin(countries, eq(spots.countryId, countries.id))
    .leftJoin(users, eq(spots.approvedById, users.id))
    .where(eq(spots.id, spotId))
    .limit(1);
  if (!row) notFound();

  const s = row.spot;
  const t = await getT();

  // --- Deployment history: ALL campaigns that ever used this spot, both
  // currently-active and previously-active. Split by archived state for
  // the UI ("currently used in" vs "historically used in").
  const allDeployments = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
      status: campaigns.status,
      archivedAt: campaigns.archivedAt,
    })
    .from(campaignVideos)
    .innerJoin(campaigns, eq(campaignVideos.campaignId, campaigns.id))
    .where(eq(campaignVideos.spotId, spotId))
    .orderBy(desc(campaigns.startsAt));
  const activeDeployments = allDeployments.filter((c) => c.archivedAt === null);
  const historicalDeployments = allDeployments.filter(
    (c) => c.archivedAt !== null
  );

  // --- Audit history: every entry the auditLog has against this spot,
  // joined with the actor for "who did what when".
  const auditRows = await db
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
      and(eq(auditLog.entity, "spot"), eq(auditLog.entityId, spotId))
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(20);

  const action = updateSpot.bind(null, spotId);
  const isArchived = s.archivedAt !== null;
  const deploymentCount = activeDeployments.length;
  const approvalState = spotApprovalState({
    clientApprovedAt: s.clientApprovedAt,
    rejectedAt: s.rejectedAt,
  });
  const approvedBy = row.approvedByName ?? row.approvedByEmail ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3 flex-wrap">
            <span>
              {s.name ??
                (row.productName
                  ? `${row.productName} · ${row.countryCode}`
                  : `Spot · ${row.countryCode}`)}
            </span>
            <Pill size="md" tone={spotApprovalTone(approvalState)}>
              {t(spotApprovalLabelKey(approvalState))}
            </Pill>
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
            <span aria-hidden>{row.countryFlag}</span>
            <span>
              {localizedCountryName(
                row.countryCode,
                row.countryName,
                t.locale
              )}
            </span>
            {row.productName && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>{row.productName}</span>
              </>
            )}
            {isArchived && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="inline-flex items-center rounded-full bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs">
                  {t("spots.archived_at", {
                    date: formatDate(s.archivedAt!),
                  })}
                </span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/spots"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline shrink-0"
        >
          ← {t("spots.back_to_list")}
        </Link>
      </div>

      {/* Approval section — shows current state + actor + comment, plus
          the approve/reject/reset buttons. Top-level so it's the first
          thing the user reaches for after the title. */}
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("spots.approval.section.title")}
        </h2>

        {approvalState === "approved" && s.clientApprovedAt && (
          <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
            <div>
              {t("spots.approval.approved_by", {
                who: approvedBy ?? "—",
              })}{" "}
              <span className="text-zinc-500">
                · {formatDate(s.clientApprovedAt)}
              </span>
            </div>
            <div className="text-xs text-zinc-500 italic">
              {s.clientApprovedComment?.trim() ||
                t("spots.approval.no_comment")}
            </div>
          </div>
        )}
        {approvalState === "rejected" && s.rejectedAt && (
          <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
            <div>
              {t("spots.approval.rejected_by", {
                who: approvedBy ?? "—",
              })}{" "}
              <span className="text-zinc-500">
                · {formatDate(s.rejectedAt)}
              </span>
            </div>
            <div className="text-xs text-red-700 dark:text-red-400">
              {s.rejectionReason}
            </div>
          </div>
        )}

        <SpotApprovalActions
          spotId={spotId}
          clientApprovedAt={s.clientApprovedAt}
          rejectedAt={s.rejectedAt}
          archived={isArchived}
        />
      </div>

      {/* Inline video preview — handy when re-checking what's actually
          embedded behind the URL before re-deploying. */}
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">
          {t("spots.section.preview")}
        </h2>
        <VideoEmbed url={s.videoUrl} />
      </div>

      {/* Deployment status — gives the user a reason to either archive or
          re-deploy. The list links to the campaigns currently running it. */}
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">
            {t("spots.section.deployments")}
          </h2>
          {deploymentCount === 0 ? (
            <p className="text-sm text-zinc-500">
              {t("spots.deployments.empty")}
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {activeDeployments.map((c) => (
                <li
                  key={c.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Historical deployments (archived campaigns). Keep them in a
         *  collapsed-feeling sub-section — useful for "did this spot run
         *  before" but secondary to current status. */}
        {historicalDeployments.length > 0 && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <h3 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
              {t("spots.deployment_history.title")}
            </h3>
            <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              {historicalDeployments.map((c) => (
                <li
                  key={c.id}
                  className="flex items-baseline justify-between gap-2"
                >
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span>
                    {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Audit log section — quick "who did what when" history specific
          to this spot. Limited to 20 most recent entries. */}
      <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">
          {t("spots.audit.title")}
        </h2>
        {auditRows.length === 0 ? (
          <EmptyState
            variant="plain"
            description={t("spots.audit.empty")}
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {auditRows.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">
                    {a.userName ?? a.userEmail ?? "—"}
                  </span>{" "}
                  <span className="text-zinc-500">
                    {humanizeSpotAuditAction(a.action, a.changes)}
                  </span>
                </span>
                <span className="text-xs text-zinc-500 shrink-0">
                  {formatDate(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isArchived && (
        <form action={action} className="space-y-6">
          <SpotFormBody
            defaults={{
              name: s.name,
              productName: row.productName,
              productKind: row.productKind,
              countryId: s.countryId,
              videoUrl: s.videoUrl,
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
            >
              {t("spots.form.submit_save")}
            </button>
          </div>
        </form>
      )}

      {/* Archive / unarchive / hard-delete strip. Archive is the safe
          everyday action — keeps history while hiding from default lists.
          Hard delete only works when no campaign references the spot. */}
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/40 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 px-5 py-4 flex items-center gap-3 flex-wrap">
        {isArchived ? (
          <form action={unarchiveSpot.bind(null, spotId)}>
            <button
              type="submit"
              className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {t("spots.action.unarchive")}
            </button>
          </form>
        ) : (
          <form action={archiveSpot.bind(null, spotId)}>
            <button
              type="submit"
              className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
              title={t("spots.action.archive_tooltip")}
            >
              {t("spots.action.archive")}
            </button>
          </form>
        )}
        {deploymentCount === 0 && allDeployments.length === 0 && (
          <form action={deleteSpot.bind(null, spotId)}>
            <button
              type="submit"
              className="text-sm px-3 py-1.5 text-red-600 hover:underline"
              title={t("spots.action.delete_tooltip")}
            >
              {t("spots.action.delete")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Map an audit log entry to a short Czech sentence fragment. Mirrors the
 *  campaign humanizer (app/campaigns/[id]/page.tsx) but scoped to spot
 *  actions. CS-only — admin-tier surface, EN translation skipped per
 *  i18n policy. */
function humanizeSpotAuditAction(action: string, changes: unknown): string {
  const obj =
    changes && typeof changes === "object"
      ? (changes as Record<string, unknown>)
      : null;

  if (action === "approved") {
    const note = obj && typeof obj.note === "string" ? obj.note.trim() : "";
    return note ? `schválil(a) — „${note}"` : "schválil(a)";
  }
  if (action === "rejected") {
    const reason =
      obj && typeof obj.reason === "string" ? obj.reason.trim() : "";
    return reason ? `zamítl(a) — „${reason}"` : "zamítl(a)";
  }
  if (action === "archived") return "archivoval(a)";
  if (action === "deleted") return "smazal(a)";
  if (action === "created") {
    if (obj && obj.via === "campaign-form-inline") {
      return "vytvořil(a) (z formuláře kampaně)";
    }
    return "vytvořil(a)";
  }
  if (action === "updated") {
    if (obj && obj.unarchived === true) return "obnovil(a) z archivu";
    if (obj && obj.approvalCleared === true)
      return "vrátil(a) do stavu „Čeká\"";
    if (obj && obj.approvalInvalidatedByEdit === true)
      return "upravil(a) URL — schválení automaticky resetováno";
    return "upravil(a)";
  }
  return action;
}
