"use client";

// Campaign-specific wrapper around <SidePanel />. Mounted once at the root
// layout level; it stays inert (returns null) until something — typically a
// timeline bar — calls openCampaignPeek(id) from lib/peek-store.
//
// Architecture note: this used to live as an intercepting route under
// app/@modal/(.)campaigns/[id]/page.tsx. That worked but Next.js 16's
// Turbopack dev server kept crashing under HMR with the parallel-slot +
// intercept combination, especially with two intercepts at the same level
// ((.)campaigns/new + (.)campaigns/[id]). We swapped to a plain
// fetch-and-render so the panel doesn't depend on Next.js routing internals
// at all. Trade-offs:
//   - Lost: shareable peek URL (the panel is no longer at /campaigns/<id>).
//   - Gained: a dev server that doesn't fall over.
//   - The full /campaigns/<id> page still exists for sharing / direct
//     navigation.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidePanel } from "@/components/side-panel";
import { StatusBadge } from "@/components/status-badge";
import { CommunicationBadge } from "@/components/communication-badge";
import {
  closeCampaignPeek,
  getPeekState,
  hydratePeekFromUrl,
  refreshCampaignPeek,
  subscribeToPeek,
} from "@/lib/peek-store";
import type { CampaignPeekData } from "@/app/api/campaigns/[id]/peek/route";
import { useT } from "@/lib/i18n/client";
import { localizedCountryName } from "@/lib/i18n/country";
import { kindLabel } from "@/lib/products";
import { ProductKindIcon } from "@/components/product-kind-icon";
import { CountryBadge } from "@/components/country-badge";
import {
  approveCampaign,
  archiveCampaign,
  cancelCampaign,
  clearCampaignApproval,
  cloneCampaign,
  reactivateCampaign,
} from "@/app/campaigns/[id]/actions";

export function CampaignPeek() {
  const [state, setState] = useState(getPeekState());
  const [data, setData] = useState<CampaignPeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const router = useRouter();

  // Subscribe + hydrate from URL once on mount. Hydration covers the case
  // where the user reloads (or follows a shared link) on /?peek=<id>.
  useEffect(() => {
    hydratePeekFromUrl();
    return subscribeToPeek(setState);
  }, []);

  // Fetch panel data whenever the peek id OR the gen counter changes. The
  // gen bump is what refreshCampaignPeek() relies on to force a refetch
  // after a server action mutates the campaign. Cancel-on-change so a slow
  // previous response can't overwrite a newer one.
  useEffect(() => {
    if (state.id == null) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${state.id}/peek`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as CampaignPeekData;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.id, state.gen]);

  if (state.id == null) return null;

  // Loading: render the panel shell with a placeholder title while the
  // fetch is in flight. Avoids the panel popping into existence half a
  // second after the click.
  if (loading || !data) {
    return (
      <SidePanel
        title="…"
        onClose={closeCampaignPeek}
        closeLabel={t("common.close")}
      >
        {error ? (
          <p className="text-sm text-red-600">
            {t("common.error")}: {error}
          </p>
        ) : (
          <SkeletonBody />
        )}
      </SidePanel>
    );
  }

  const c = data.campaign;
  const product = data.product;
  const startsAt = new Date(c.startsAt);
  const endsAt = new Date(c.endsAt);
  const dur = daysBetween(startsAt, endsAt);
  const runState = computedRunStateClient(c.status, startsAt, endsAt);

  return (
    <SidePanel
      title={c.name}
      onClose={closeCampaignPeek}
      closeLabel={t("common.close")}
      subtitle={
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
            style={{ background: c.color }}
            aria-hidden
          />
          <StatusBadge status={c.status} runState={runState} />
          <CommunicationBadge type={c.communicationType} />
          {c.clientApprovedAt ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300"
              title={
                c.approvedByName
                  ? t("approval.approved_by", { who: c.approvedByName })
                  : undefined
              }
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8.5 L7 12 L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("approval.approved")}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
              {t("approval.waiting")}
            </span>
          )}
          {c.client && (
            <span className="text-xs text-zinc-500">{c.client}</span>
          )}
        </div>
      }
      footer={
        <>
          <Link
            href={`/campaigns/${c.id}`}
            onClick={closeCampaignPeek}
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
          >
            {t("ctx.open_detail")}
          </Link>
          <Link
            href={`/campaigns/${c.id}/edit`}
            onClick={closeCampaignPeek}
            className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {t("detail.edit")}
          </Link>
          {/* Approve / unapprove right next to Edit so it's the first thing
              the eye hits after Open. The label flips based on current
              state; the action stays in the panel and bumps gen so the
              fresh state shows up without close/reopen. */}
          {c.clientApprovedAt ? (
            <form
              action={async () => {
                await clearCampaignApproval(c.id);
                refreshCampaignPeek();
                // Also refresh the timeline behind so the bar's stripes
                // (re)appear without the user navigating.
                router.refresh();
              }}
            >
              <button
                type="submit"
                className="text-sm px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                {t("approval.unapprove")}
              </button>
            </form>
          ) : (
            <form
              action={async () => {
                await approveCampaign(c.id);
                refreshCampaignPeek();
                router.refresh();
              }}
            >
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {t("approval.approve")}
              </button>
            </form>
          )}
          <form
            action={async () => {
              await cloneCampaign(c.id);
              // cloneCampaign redirects to /campaigns/<newId>/edit, so the
              // panel will unmount with the navigation. closeCampaignPeek
              // here is belt-and-braces: if redirect ever changes, panel
              // still closes cleanly.
              closeCampaignPeek();
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
          {/* Status toggle — cancel ↔ reactivate. Both leave the panel open
              and bump the peek's gen counter so the next render reflects the
              new state without the user closing/reopening. */}
          {c.status !== "cancelled" ? (
            <form
              action={async () => {
                await cancelCampaign(c.id);
                refreshCampaignPeek();
                router.refresh();
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
                await reactivateCampaign(c.id);
                refreshCampaignPeek();
                router.refresh();
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
          {/* Archive redirects to /campaigns, which navigates away from the
              current page. Close the panel imperatively too so URL state and
              UI state stay in sync regardless of where the redirect lands. */}
          <form
            action={async () => {
              await archiveCampaign(c.id);
              closeCampaignPeek();
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
        <Block label={`${t("common.start")} – ${t("common.end")}`}>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatDateClient(startsAt, t.locale)} –{" "}
            {formatDateClient(endsAt, t.locale)}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {dur} {t.plural(dur, "unit.day")}
          </div>
        </Block>

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
                    <ProductKindIcon kind={product.kind} className="w-3 h-3" />
                    {kindLabel(product.kind)}
                  </span>
                </div>
                {product.releaseDate && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {t("detail.product_released", {
                      date: formatDateClient(
                        new Date(product.releaseDate),
                        t.locale
                      ),
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

        {data.videos.length > 0 && (
          <Block
            label={`${t("detail.videos_section")} (${
              data.videos.filter((v) => v.videoUrl).length
            }/${data.videos.length})`}
            action={
              data.videos.some((v) => !v.videoUrl) ? (
                <Link
                  href={`/campaigns/${c.id}/edit`}
                  onClick={closeCampaignPeek}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {t("detail.assign_spots")}
                </Link>
              ) : undefined
            }
          >
            <ul className="space-y-1.5">
              {data.videos.map((v) => (
                <li
                  key={v.countryCode}
                  className="flex items-center gap-2 text-xs"
                >
                  <CountryBadge
                    code={v.countryCode}
                    flag={v.countryFlag}
                    size="xs"
                  />
                  <span className="font-medium w-12 shrink-0">
                    {v.countryCode}
                  </span>
                  {v.videoUrl ? (
                    <>
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                      >
                        {v.spotName ?? v.videoUrl}
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
                    </>
                  ) : (
                    <span className="italic text-amber-700 dark:text-amber-400 flex-1">
                      {t("detail.spot_pending")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Block>
        )}

        <Block
          label={`${t("detail.channels_section")} (${data.channels.length})`}
        >
          <div className="flex flex-wrap gap-1.5">
            {data.channels.map((ch, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs"
              >
                <CountryBadge
                  code={ch.countryCode}
                  flag={ch.countryFlag}
                  size="xs"
                />
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

        {c.notes && (
          <Block label={t("detail.notes_section")}>
            <p className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 line-clamp-6">
              {c.notes}
            </p>
          </Block>
        )}

        {data.totalComments > 0 && (
          <Block
            label={`${t("detail.comments_section")} (${data.totalComments})`}
            action={
              <Link
                href={`/campaigns/${c.id}#comments`}
                onClick={closeCampaignPeek}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("ctx.open_detail")}
              </Link>
            }
          >
            <ul className="space-y-2">
              {data.recentComments.map((cm) => (
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
                      {formatRelativeClient(new Date(cm.createdAt), t.locale)}
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

function SkeletonBody() {
  return (
    <div className="space-y-5 text-sm" aria-hidden>
      {[2, 3, 2, 2].map((lines, i) => (
        <div key={i}>
          <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 mb-2 animate-pulse" />
          <div className="space-y-1.5">
            {Array.from({ length: lines }).map((_, j) => (
              <div
                key={j}
                className="h-3 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                style={{ width: `${90 - j * 18}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Client-side helpers — server-side equivalents in lib/utils.ts use Date
// objects from the DB; here we get ISO strings out of JSON, parse them, and
// duplicate the formatting so we don't drag server-only code into the bundle.

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function computedRunStateClient(
  status: string,
  startsAt: Date,
  endsAt: Date
): "upcoming" | "active" | "done" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  const now = Date.now();
  if (now < startsAt.getTime()) return "upcoming";
  if (now > endsAt.getTime() + 86_400_000) return "done";
  return "active";
}

function formatDateClient(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatRelativeClient(d: Date, locale: string): string {
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return locale === "cs" ? "teď" : "now";
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const dd = Math.floor(hr / 24);
  if (dd < 7) return `${dd} d`;
  return formatDateClient(d, locale);
}
