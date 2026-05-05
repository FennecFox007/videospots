"use client";

// Read-only timeline used on /share/<token> for public viewers. Mirrors the
// visual layout of the interactive Timeline but with no drag, no menus, no
// edits — viewers can only LOOK and click a bar to peek the video and basic
// metadata. The peek modal is the whole reason this is a client component;
// the rest of the layout is the same arithmetic the authed timeline does.

import { useEffect, useMemo, useState } from "react";
import {
  daysBetween,
  formatDate,
  formatDateShort,
  formatMonthName,
  pluralCs,
} from "@/lib/utils";
import {
  communicationTypeClasses,
  communicationTypeLabel,
} from "@/lib/communication";
import { localizedCountryName } from "@/lib/i18n/country";
import type { Locale } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/client";
import { VideoEmbed } from "@/components/video-embed";

export type PublicChannel = {
  id: number;
  chainName: string;
};

export type PublicCountryGroup = {
  id: number;
  /** ISO code, used to localize the country name when locale=en. */
  code: string;
  name: string;
  flag: string | null;
  channels: PublicChannel[];
};

export type PublicCampaign = {
  campaignId: number;
  name: string;
  color: string;
  status: string;
  communicationType: string | null;
  coverUrl: string | null;
  /** EFFECTIVE start/end — already coalesced from per-channel override over
   *  master campaign dates in fetchTimelineCampaigns. */
  startsAt: Date;
  endsAt: Date;
  channelId: number;
  /** Per-country video URL for the bar. Set by joining campaign_video on
   *  channel.countryId in fetchTimelineCampaigns; null if this country
   *  doesn't have its own language cut. */
  videoUrl: string | null;
  /** Set when this ONE channel is cancelled (independent of campaign-level
   *  status). The bar reads as cancelled if either is true. */
  channelCancelledAt: Date | null;
  /** True when the bar's dates / cancellation diverge from the master
   *  campaign. Drives the italic + ✱ marker on the bar's name so the
   *  reader knows this retailer's schedule is different. */
  hasChannelOverride: boolean;
  /** Client approval timestamp. Null = waiting for approval; the share
   *  modal then shows the "Schvaluji" button. Permanent once set. */
  clientApprovedAt: Date | null;
};

type Props = {
  groups: PublicCountryGroup[];
  campaigns: PublicCampaign[];
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
  /** BCP-47 locale tag (e.g. "cs-CZ", "en-US"). Used for month names in the
   *  header. Defaults to Czech for back-compat with existing share links. */
  locale?: string;
  /** UI locale ("cs" | "en"). Used for country-name lookup. */
  uiLocale?: Locale;
};

const BAR_HEIGHT = 28;
const BAR_MIN_WIDTH_PX = 24;
const LANE_GAP = 4;
const ROW_PAD_TOP = 4;
const ROW_PAD_BOTTOM = 4;
const ONE_DAY_MS = 86_400_000;
const COMPACT_DAY_THRESHOLD = 45;

type SelectedBar = PublicCampaign & {
  countryName: string;
  countryFlag: string | null;
  countryCode: string;
  chainName: string;
};

export function PublicTimeline({
  groups,
  campaigns,
  rangeStart,
  rangeEnd,
  now,
  locale = "cs-CZ",
  uiLocale = "cs",
}: Props) {
  const [selected, setSelected] = useState<SelectedBar | null>(null);

  // Lookup channelId → { country, chain } so bar clicks can resolve the
  // bar's context for the modal title without us re-fetching anything.
  const channelLookup = useMemo(() => {
    const m = new Map<
      number,
      {
        countryName: string;
        countryFlag: string | null;
        countryCode: string;
        chainName: string;
      }
    >();
    for (const g of groups) {
      for (const ch of g.channels) {
        m.set(ch.id, {
          countryName: g.name,
          countryFlag: g.flag,
          countryCode: g.code,
          chainName: ch.chainName,
        });
      }
    }
    return m;
  }, [groups]);

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const totalDays = Math.round(totalMs / ONE_DAY_MS);
  const compact = totalDays <= COMPACT_DAY_THRESHOLD;

  const pct = (d: Date) => {
    const raw = ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
    return Math.round(raw * 10000) / 10000;
  };
  const clamp = (d: Date) =>
    d < rangeStart ? rangeStart : d > rangeEnd ? rangeEnd : d;

  // Per-day cells.
  type DayCell = {
    date: Date;
    pct: number;
    isWeekend: boolean;
    isMonday: boolean;
    isFirstOfMonth: boolean;
  };
  const days: DayCell[] = [];
  {
    const cur = new Date(rangeStart);
    cur.setHours(0, 0, 0, 0);
    while (cur < rangeEnd) {
      const dow = cur.getDay();
      days.push({
        date: new Date(cur),
        pct: pct(cur),
        isWeekend: dow === 0 || dow === 6,
        isMonday: dow === 1,
        isFirstOfMonth: cur.getDate() === 1,
      });
      cur.setDate(cur.getDate() + 1);
    }
  }
  const dayWidthPct = 100 / Math.max(1, totalDays);

  // Month bands.
  type MonthBand = { name: string; startPct: number; endPct: number };
  const monthBands: MonthBand[] = [];
  {
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur < rangeEnd) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const start = cur < rangeStart ? rangeStart : cur;
      const end = next > rangeEnd ? rangeEnd : next;
      monthBands.push({
        name: formatMonthName(cur, locale),
        startPct: pct(start),
        endPct: pct(end),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const todayPct = pct(now);
  const showToday = todayPct >= 0 && todayPct <= 100;

  // Lane assignment per channel (greedy first-fit).
  const byChannel = new Map<number, PublicCampaign[]>();
  for (const c of campaigns) {
    if (!byChannel.has(c.channelId)) byChannel.set(c.channelId, []);
    byChannel.get(c.channelId)!.push(c);
  }
  type LaneInfo = { lanes: Map<number, number>; laneCount: number };
  const laneInfoByChannel = new Map<number, LaneInfo>();
  for (const [channelId, list] of byChannel) {
    laneInfoByChannel.set(channelId, assignLanes(list));
  }

  return (
    <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Header */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="w-32 sm:w-48 shrink-0 px-4 text-xs font-medium text-zinc-500 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-end pb-2">
            Kanál
          </div>
          <div className="flex-1 relative">
            <div className="h-6 relative border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
              {monthBands.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full px-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 capitalize"
                  style={{
                    left: `${m.startPct}%`,
                    width: `${m.endPct - m.startPct}%`,
                  }}
                >
                  <span className="truncate">{m.name}</span>
                </div>
              ))}
            </div>
            <div className="h-7 relative">
              {compact ? (
                days.map((d) => (
                  <div
                    key={d.date.toISOString()}
                    className={
                      "absolute top-0 h-full text-[10px] flex items-center justify-center border-l pointer-events-none " +
                      (d.isFirstOfMonth
                        ? "border-zinc-300 dark:border-zinc-600 "
                        : d.isMonday
                          ? "border-zinc-200 dark:border-zinc-700 "
                          : "border-zinc-100 dark:border-zinc-800/60 ") +
                      (d.isWeekend
                        ? "text-zinc-400 dark:text-zinc-600 "
                        : d.isMonday
                          ? "font-medium text-zinc-700 dark:text-zinc-300 "
                          : "text-zinc-500 dark:text-zinc-400 ")
                    }
                    style={{ left: `${d.pct}%`, width: `${dayWidthPct}%` }}
                  >
                    {d.date.getDate()}
                  </div>
                ))
              ) : (
                days
                  .filter((d) => d.isMonday)
                  .map((d) => (
                    <div
                      key={d.date.toISOString()}
                      className="absolute top-0 h-full text-[11px] text-zinc-500 px-1 pointer-events-none"
                      style={{ left: `${d.pct}%` }}
                    >
                      <div className="absolute top-0 bottom-0 left-0 border-l border-zinc-100 dark:border-zinc-800" />
                      <span className="ml-1 leading-7">
                        {formatDateShort(d.date)}
                      </span>
                    </div>
                  ))
              )}
              {showToday && (
                <>
                  <div
                    className="absolute -top-6 bottom-0 border-l-2 border-red-500 pointer-events-none"
                    style={{ left: `${todayPct}%` }}
                  />
                  <div
                    className="absolute -translate-x-1/2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold tracking-wide rounded shadow z-20 pointer-events-none"
                    style={{ left: `${todayPct}%`, top: "-22px" }}
                  >
                    DNES
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        {groups.map((g, gi) => (
          <div
            key={g.id}
            className={
              gi > 0
                ? "border-t-[3px] border-zinc-300 dark:border-zinc-700"
                : ""
            }
          >
            <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <div className="w-32 sm:w-48 shrink-0 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-base leading-none">{g.flag}</span>
                <span>{localizedCountryName(g.code, g.name, uiLocale)}</span>
              </div>
              <div className="flex-1" />
            </div>

            {g.channels.map((ch) => {
              const bars = byChannel.get(ch.id) ?? [];
              const info =
                laneInfoByChannel.get(ch.id) ??
                ({ lanes: new Map(), laneCount: 1 } as LaneInfo);
              const rowHeight =
                ROW_PAD_TOP +
                info.laneCount * BAR_HEIGHT +
                Math.max(0, info.laneCount - 1) * LANE_GAP +
                ROW_PAD_BOTTOM;

              return (
                <div
                  key={ch.id}
                  className="flex border-b border-zinc-100 dark:border-zinc-800"
                >
                  <div
                    className="w-32 sm:w-48 shrink-0 px-4 text-sm text-zinc-700 dark:text-zinc-300 border-r border-zinc-100 dark:border-zinc-800 truncate flex items-center"
                    style={{ minHeight: rowHeight }}
                  >
                    {ch.chainName}
                  </div>
                  <div
                    className="flex-1 relative"
                    style={{ height: rowHeight }}
                  >
                    {compact &&
                      days
                        .filter((d) => d.isWeekend)
                        .map((d) => (
                          <div
                            key={d.date.toISOString()}
                            className="absolute top-0 bottom-0 bg-zinc-100/60 dark:bg-zinc-800/40 pointer-events-none"
                            style={{
                              left: `${d.pct}%`,
                              width: `${dayWidthPct}%`,
                            }}
                          />
                        ))}
                    {compact &&
                      days.map((d) => (
                        <div
                          key={d.date.toISOString()}
                          className={
                            "absolute top-0 bottom-0 border-l pointer-events-none " +
                            (d.isFirstOfMonth
                              ? "border-zinc-300 dark:border-zinc-600"
                              : d.isMonday
                                ? "border-zinc-200 dark:border-zinc-700"
                                : "border-zinc-100/60 dark:border-zinc-800/40")
                          }
                          style={{ left: `${d.pct}%` }}
                        />
                      ))}
                    {!compact &&
                      days
                        .filter((d) => d.isMonday || d.isFirstOfMonth)
                        .map((d) => (
                          <div
                            key={d.date.toISOString()}
                            className={
                              "absolute top-0 bottom-0 border-l pointer-events-none " +
                              (d.isFirstOfMonth
                                ? "border-zinc-300 dark:border-zinc-600"
                                : "border-zinc-100 dark:border-zinc-800")
                            }
                            style={{ left: `${d.pct}%` }}
                          />
                        ))}
                    {showToday && (
                      <div
                        className="absolute top-0 bottom-0 border-l border-red-500/40 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}
                    {bars.map((b) => {
                      const left = pct(clamp(b.startsAt));
                      const visualEnd = new Date(
                        b.endsAt.getTime() + ONE_DAY_MS
                      );
                      const right = pct(clamp(visualEnd));
                      const width = Math.max(right - left, 0.5);
                      const laneIdx = info.lanes.get(b.campaignId) ?? 0;
                      const top =
                        ROW_PAD_TOP + laneIdx * (BAR_HEIGHT + LANE_GAP);
                      const isCancelled =
                        b.status === "cancelled" ||
                        b.channelCancelledAt !== null;
                      const isRunning =
                        !isCancelled &&
                        now.getTime() >= b.startsAt.getTime() &&
                        now.getTime() <=
                          b.endsAt.getTime() + ONE_DAY_MS;
                      const totalSpan =
                        b.endsAt.getTime() + ONE_DAY_MS - b.startsAt.getTime();
                      const elapsedRatio =
                        isRunning && totalSpan > 0
                          ? Math.max(
                              0,
                              Math.min(
                                1,
                                (now.getTime() - b.startsAt.getTime()) /
                                  totalSpan
                              )
                            )
                          : 0;
                      const dur = daysBetween(b.startsAt, b.endsAt);
                      const commLabel = b.communicationType
                        ? communicationTypeLabel(b.communicationType)
                        : "";
                      const ctx = channelLookup.get(b.channelId);
                      const openPeek = () => {
                        if (!ctx) return;
                        setSelected({ ...b, ...ctx });
                      };
                      return (
                        // <div role="button"> rather than a real <button>: we
                        // want a nested <a> for the play overlay (HTML
                        // disallows interactive content inside a button).
                        // Mirrors the authed timeline's bar shape.
                        <div
                          key={`${b.campaignId}-${b.channelId}`}
                          role="button"
                          tabIndex={0}
                          aria-label={b.name}
                          className="absolute text-white text-xs px-2 rounded flex items-center overflow-hidden z-[1] cursor-pointer transition-shadow hover:ring-2 hover:ring-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: BAR_MIN_WIDTH_PX,
                            top: `${top}px`,
                            height: `${BAR_HEIGHT}px`,
                            background: isCancelled ? "#9ca3af" : b.color,
                            outline: isCancelled
                              ? "1px solid #9ca3af"
                              : undefined,
                            textDecoration: isCancelled
                              ? "line-through"
                              : undefined,
                            opacity: isCancelled ? 0.45 : 1,
                          }}
                          title={`${b.name}\n${formatDate(b.startsAt)} – ${formatDate(b.endsAt)} (${dur} ${pluralCs(dur, "den", "dny", "dní")})${commLabel ? `\n${commLabel}` : ""}`}
                          onClick={openPeek}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openPeek();
                            }
                          }}
                        >
                          {elapsedRatio > 0 && !isCancelled && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-0 bottom-0 bg-black/30 pointer-events-none"
                              style={{ width: `${elapsedRatio * 100}%` }}
                            />
                          )}
                          {b.coverUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={b.coverUrl}
                              alt=""
                              className="w-4 h-4 rounded-sm object-cover shrink-0 mr-1 ring-1 ring-white/30 pointer-events-none"
                              loading="lazy"
                            />
                          )}
                          <span
                            className={`truncate font-medium pointer-events-none${b.hasChannelOverride ? " italic" : ""}`}
                          >
                            {b.hasChannelOverride && (
                              <span aria-hidden className="mr-0.5 opacity-90">
                                ✱
                              </span>
                            )}
                            {b.name}
                          </span>
                          {b.videoUrl && !isCancelled && (
                            // Small white play circle on the right edge —
                            // same affordance as the authed timeline. Click
                            // opens the source URL in a new tab; click on
                            // the bar itself (anywhere outside this anchor)
                            // opens the in-app modal with the embedded
                            // player. stopPropagation so the bar's onClick
                            // doesn't ALSO fire and pop a modal we didn't
                            // ask for.
                            <a
                              href={b.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Přehrát spot — ${b.name}`}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/95 hover:bg-white text-zinc-900 flex items-center justify-center shadow-sm ring-1 ring-black/10 transition-colors cursor-pointer"
                              style={{ touchAction: "manipulation" }}
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            Žádné kanály.
          </div>
        )}
        {groups.length > 0 && campaigns.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
            V tomto rozsahu nejsou žádné kampaně.
          </div>
        )}
      </div>

      {selected && (
        <PublicCampaignModal
          bar={selected}
          uiLocale={uiLocale}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// Read-only peek over a single (campaign × channel) bar — opened from a
// click on the public timeline. Shows the spot for the bar's country (the
// reason this exists at all — partner specifically asked for "klient si
// pustí spot ze sdíleného náhledu") plus enough metadata to know which
// retailer / country / dates we're looking at.
function PublicCampaignModal({
  bar,
  uiLocale,
  onClose,
}: {
  bar: SelectedBar;
  uiLocale: Locale;
  onClose: () => void;
}) {
  const t = useT();
  // ESC closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const dur = daysBetween(bar.startsAt, bar.endsAt);
  const isCancelled = bar.status === "cancelled";
  const commLabel = bar.communicationType
    ? communicationTypeLabel(bar.communicationType)
    : "";
  const commCls = bar.communicationType
    ? communicationTypeClasses(bar.communicationType)
    : "";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-campaign-modal-title"
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-lg shadow-2xl ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700 shrink-0"
                style={{ background: isCancelled ? "#9ca3af" : bar.color }}
                aria-hidden
              />
              <h2
                id="public-campaign-modal-title"
                className="text-lg font-semibold tracking-tight truncate"
                style={{
                  textDecoration: isCancelled ? "line-through" : undefined,
                }}
              >
                {bar.name}
              </h2>
            </div>
            <div className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
              <span aria-hidden>{bar.countryFlag}</span>
              <span>
                {localizedCountryName(
                  bar.countryCode,
                  bar.countryName,
                  uiLocale
                )}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="font-medium">{bar.chainName}</span>
              {commLabel && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <span
                    className={`text-[11px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${commCls}`}
                  >
                    {commLabel}
                  </span>
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {formatDate(bar.startsAt)} – {formatDate(bar.endsAt)} · {dur}{" "}
              {pluralCs(dur, "den", "dny", "dní")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 -m-1 p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {bar.videoUrl ? (
            <VideoEmbed url={bar.videoUrl} />
          ) : (
            <div className="rounded-md bg-zinc-50 dark:bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">
              {/* Czech only — partner test was in Czech and this string is
                  rare enough to keep simple. Localise if EN-mode share gets
                  used in practice. */}
              Pro tento řetězec není zatím přiřazený spot.
            </div>
          )}

          {/* Approval status — info-only in share view. The bar carries
              clientApprovedAt as part of its data; if it's set we show a
              green badge, otherwise nothing (the share viewer can't
              approve, that's an authenticated action). */}
          {bar.clientApprovedAt && (
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
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
              <span>
                Schváleno{" "}
                {new Intl.DateTimeFormat("cs-CZ", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(bar.clientApprovedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function assignLanes(bars: PublicCampaign[]): {
  lanes: Map<number, number>;
  laneCount: number;
} {
  const sorted = [...bars].sort((a, b) => {
    const ds = a.startsAt.getTime() - b.startsAt.getTime();
    if (ds !== 0) return ds;
    return b.endsAt.getTime() - a.endsAt.getTime();
  });
  const laneEnds: number[] = [];
  const lanes = new Map<number, number>();
  for (const b of sorted) {
    let placed = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= b.startsAt.getTime()) {
        laneEnds[i] = b.endsAt.getTime();
        placed = i;
        break;
      }
    }
    if (placed === -1) {
      laneEnds.push(b.endsAt.getTime());
      placed = laneEnds.length - 1;
    }
    lanes.set(b.campaignId, placed);
  }
  return { lanes, laneCount: Math.max(1, laneEnds.length) };
}
