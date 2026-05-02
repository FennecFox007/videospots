"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  moveCampaign,
  moveCampaignToChannel,
  cancelCampaign,
  reactivateCampaign,
  cloneCampaign,
  archiveCampaign,
} from "@/app/campaigns/[id]/actions";
import {
  addDays,
  daysBetween,
  formatDate,
  formatDateShort,
  formatMonthName,
  pluralCs,
  snapToMondayStart,
  toDateInputValue,
} from "@/lib/utils";
import {
  ContextMenu,
  type ContextMenuItem,
} from "@/components/context-menu";
import {
  communicationTypeClasses,
  communicationTypeLabel,
  computeLifecyclePhase,
  lifecycleLabel,
} from "@/lib/communication";

export type TimelineChannel = {
  id: number;
  chainName: string;
  /** Chain code (e.g. "alza") — used for "Filter on this chain" links. */
  chainCode: string;
};

export type TimelineCountryGroup = {
  id: number;
  /** Country code (e.g. "CZ") — used for "Filter on this country" links. */
  code: string;
  name: string;
  flag: string | null;
  channels: TimelineChannel[];
};

export type TimelineCampaign = {
  campaignId: number;
  name: string;
  color: string;
  status: string; // approved | cancelled
  /** Communication intent (preorder/launch/outnow/...). Shown in tooltip + as
   *  context for the lifecycle phase. Null when not set. */
  communicationType: string | null;
  /** Product cover image URL (joined from product table). Optional thumbnail. */
  coverUrl: string | null;
  /** Product release date (joined). When inside the bar, we draw a small star
   *  marker; either way it feeds lifecycle phase computation in the tooltip. */
  productReleaseDate: Date | null;
  startsAt: Date;
  endsAt: Date;
  channelId: number;
};

type Props = {
  groups: TimelineCountryGroup[];
  campaigns: TimelineCampaign[];
  rangeStart: Date;
  rangeEnd: Date;
  /** "Now" snapshot. Passed from the server so SSR and hydration agree on the
   * red "DNES" line position (otherwise milliseconds of drift cause React
   * hydration mismatch warnings). */
  now: Date;
};

// Bar geometry (pixels). Each channel row has 1+ lanes; bars in the same lane
// never overlap in time, so multiple parallel campaigns just stack.
const BAR_HEIGHT = 28;
const BAR_MIN_WIDTH_PX = 24; // make 1-day bars clickable instead of hairlines
const LANE_GAP = 4;
const ROW_PAD_TOP = 4;
const ROW_PAD_BOTTOM = 4;
const RESIZE_EDGE_PX = 8;
const CLICK_THRESHOLD_PX = 5;
const ONE_DAY_MS = 86_400_000;

// Above this many visible days, daily labels become illegible — fall back to
// weekly Monday-only markers (matches the wide quarter view).
const COMPACT_DAY_THRESHOLD = 45;

const ROW_BG = "bg-white dark:bg-zinc-900";
const GROUP_HEADER_BG = "bg-zinc-50 dark:bg-zinc-950";
const WEEKEND_BG = "bg-zinc-100/60 dark:bg-zinc-800/40";

/**
 * Gantt-style timeline. Server fetches data; this client island handles
 * drag-to-move and drag-to-resize on bars.
 *
 * Rendering density adapts to the visible range:
 * - ≤ 45 days: per-day labels in header, daily grid lines, weekend shading
 * - > 45 days: only Monday markers (a quarter would be unreadable per-day)
 */
export function Timeline({
  groups,
  campaigns,
  rangeStart,
  rangeEnd,
  now,
}: Props) {
  // Right-click menu state. Single shared instance; only one menu is open at
  // a time. Position is in viewport (clientX/Y) since the menu is `fixed`.
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Hover tooltip state — single shared instance, anchored to the bar's
  // viewport rect. Bars trigger via onMouseEnter (with 250ms delay so brief
  // pointer flybys don't fire) and clear via onMouseLeave.
  const [hoverTooltip, setHoverTooltip] = useState<{
    bar: TimelineCampaign;
    rect: DOMRect;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Header drag-pan: grab the days strip and drag left/right to scrub through
  // dates. Visually we just translateX the right-side track during the drag;
  // on release we round to whole days and navigate to a new ?from=&to=.
  // ---------------------------------------------------------------------------
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [panPx, setPanPx] = useState(0);
  const [panDrag, setPanDrag] = useState<{
    startX: number;
    msPerPx: number;
  } | null>(null);
  // Live cursor position during pan, for the floating "Zobrazí: …" preview.
  // Tracks shift state so the tooltip can show the snapped range too.
  const [panCursor, setPanCursor] = useState<{
    x: number;
    y: number;
    shift: boolean;
  } | null>(null);

  function onHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    setPanDrag({
      startX: e.clientX,
      msPerPx: totalMs / Math.max(1, rect.width),
    });
    setPanCursor({ x: e.clientX, y: e.clientY, shift: e.shiftKey });
  }

  function onHeaderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panDrag) return;
    setPanPx(e.clientX - panDrag.startX);
    setPanCursor({ x: e.clientX, y: e.clientY, shift: e.shiftKey });
  }

  function onHeaderPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!panDrag) return;
    const target = e.currentTarget;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    const deltaPx = e.clientX - panDrag.startX;
    const msPerPx = panDrag.msPerPx;
    const shift = e.shiftKey;
    setPanDrag(null);
    setPanPx(0);
    setPanCursor(null);

    // Below threshold = treat as a click on the header, no nav.
    if (Math.abs(deltaPx) < 5) return;

    // Drag right (positive deltaPx) = pull the past into view = shift range
    // backward in time (rangeStart and rangeEnd both decrease).
    const deltaMs = -deltaPx * msPerPx;
    const deltaDays = Math.round(deltaMs / ONE_DAY_MS);
    if (deltaDays === 0) return;

    let newStart = addDays(rangeStart, deltaDays);
    let newEnd = addDays(rangeEnd, deltaDays);
    if (shift) {
      // Shift+drag = snap rangeStart to Monday, preserve length.
      const totalMsBefore = rangeEnd.getTime() - rangeStart.getTime();
      newStart = snapToMondayStart(newStart);
      newEnd = new Date(newStart.getTime() + totalMsBefore);
    }
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("from", toDateInputValue(newStart));
    sp.set("to", toDateInputValue(newEnd));
    router.push(`${pathname}?${sp.toString()}`);
  }

  function onHeaderPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (!panDrag) return;
    const target = e.currentTarget;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    setPanDrag(null);
    setPanPx(0);
    setPanCursor(null);
  }

  function onHeaderDoubleClick() {
    // Quick "jump to today" — convenience that pairs well with header drag,
    // since panning far away is now easy. Snaps to Monday-of-this-week and
    // preserves the current range length.
    const totalMsBefore = rangeEnd.getTime() - rangeStart.getTime();
    const newStart = snapToMondayStart(new Date());
    const newEnd = new Date(newStart.getTime() + totalMsBefore);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("from", toDateInputValue(newStart));
    sp.set("to", toDateInputValue(newEnd));
    router.push(`${pathname}?${sp.toString()}`);
  }

  // Computed preview range while panning — exposed to the floating tooltip.
  let panPreview: { start: Date; end: Date; snapped: boolean } | null = null;
  if (panDrag && panCursor && Math.abs(panPx) >= 5) {
    const deltaMs = -panPx * panDrag.msPerPx;
    const deltaDays = Math.round(deltaMs / ONE_DAY_MS);
    let s = addDays(rangeStart, deltaDays);
    let e = addDays(rangeEnd, deltaDays);
    if (panCursor.shift) {
      const len = rangeEnd.getTime() - rangeStart.getTime();
      s = snapToMondayStart(s);
      e = new Date(s.getTime() + len);
    }
    panPreview = { start: s, end: e, snapped: panCursor.shift };
  }

  // Inline style applied to all right-side tracks during pan so they translate
  // together. Left "Kanál" column is sticky and stays put. Style is undefined
  // when at rest to avoid creating a stacking context unnecessarily.
  const panStyle: React.CSSProperties | undefined =
    panPx !== 0 ? { transform: `translateX(${panPx}px)` } : undefined;

  /**
   * Convert a click X coordinate inside the timeline track to a snapped Date.
   * Used to seed the "Create campaign here" prefill so the new bar starts on
   * the day the user right-clicked.
   */
  function dateAtClick(track: HTMLElement, clientX: number): Date {
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width)
    );
    const ms =
      rangeStart.getTime() + ratio * (rangeEnd.getTime() - rangeStart.getTime());
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function buildEmptyTrackMenu(
    e: React.MouseEvent,
    channel: TimelineChannel,
    country: TimelineCountryGroup
  ): ContextMenuItem[] {
    const start = dateAtClick(e.currentTarget as HTMLElement, e.clientX);
    const end = addDays(start, 7);
    const baseUrl = (channelIds: number[]) =>
      `/campaigns/new?channels=${channelIds.join(",")}&from=${toDateInputValue(start)}&to=${toDateInputValue(end)}`;
    const allCountryChannels = country.channels.map((c) => c.id);
    return [
      {
        kind: "link",
        label: `+ Vytvořit kampaň zde (${channel.chainName}, od ${formatDateShort(start)})`,
        href: baseUrl([channel.id]),
      },
      {
        kind: "link",
        label: `+ Kampaň pro celé ${country.name}`,
        href: baseUrl(allCountryChannels),
      },
      { kind: "separator" },
      {
        kind: "link",
        label: `Filtrovat na ${channel.chainName}`,
        href: `?chain=${encodeURIComponent(channel.chainCode)}`,
      },
      {
        kind: "link",
        label: `Filtrovat na ${country.name}`,
        href: `?country=${encodeURIComponent(country.code)}`,
      },
    ];
  }

  function buildBarMenu(bar: TimelineCampaign): ContextMenuItem[] {
    const isCancelled = bar.status === "cancelled";
    return [
      {
        kind: "link",
        label: "Otevřít detail",
        href: `/campaigns/${bar.campaignId}`,
      },
      {
        kind: "link",
        label: "Upravit",
        href: `/campaigns/${bar.campaignId}/edit`,
      },
      { kind: "separator" },
      {
        kind: "action",
        label: "Posunout o týden ←",
        onClick: () => shiftBar(bar, -7),
      },
      {
        kind: "action",
        label: "Posunout o týden →",
        onClick: () => shiftBar(bar, 7),
      },
      { kind: "separator" },
      {
        kind: "action",
        label: "Klonovat",
        onClick: () => cloneCampaign(bar.campaignId),
      },
      {
        kind: "action",
        label: isCancelled ? "Obnovit" : "Zrušit (historicky)",
        onClick: () =>
          isCancelled
            ? reactivateCampaign(bar.campaignId)
            : cancelCampaign(bar.campaignId),
      },
      { kind: "separator" },
      {
        kind: "action",
        label: "Archivovat",
        destructive: true,
        onClick: () => archiveCampaign(bar.campaignId),
      },
    ];
  }

  function buildChannelLabelMenu(
    channel: TimelineChannel,
    country: TimelineCountryGroup
  ): ContextMenuItem[] {
    return [
      {
        kind: "link",
        label: `+ Nová kampaň pro ${channel.chainName}`,
        href: `/campaigns/new?channels=${channel.id}`,
      },
      {
        kind: "link",
        label: `+ Kampaň pro celé ${country.name}`,
        href: `/campaigns/new?channels=${country.channels.map((c) => c.id).join(",")}`,
      },
      { kind: "separator" },
      {
        kind: "link",
        label: `Filtrovat na ${channel.chainName}`,
        href: `?chain=${encodeURIComponent(channel.chainCode)}`,
      },
    ];
  }

  function buildCountryHeaderMenu(
    country: TimelineCountryGroup
  ): ContextMenuItem[] {
    return [
      {
        kind: "link",
        label: `+ Kampaň pro celé ${country.name}`,
        href: `/campaigns/new?channels=${country.channels.map((c) => c.id).join(",")}`,
      },
      { kind: "separator" },
      {
        kind: "link",
        label: `Filtrovat na ${country.name}`,
        href: `?country=${encodeURIComponent(country.code)}`,
      },
    ];
  }

  async function shiftBar(bar: TimelineCampaign, daysOffset: number) {
    const ms = daysOffset * 86_400_000;
    await moveCampaign(
      bar.campaignId,
      new Date(bar.startsAt.getTime() + ms),
      new Date(bar.endsAt.getTime() + ms)
    );
  }

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const totalDays = Math.round(totalMs / ONE_DAY_MS);
  const compact = totalDays <= COMPACT_DAY_THRESHOLD;

  // Round to 4 decimals (~0.01% precision) so SSR and client hydration produce
  // the same inline-style strings — full-precision floats can render slightly
  // differently across runs.
  const pct = (d: Date) => {
    const raw = ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
    return Math.round(raw * 10000) / 10000;
  };

  const clamp = (d: Date) =>
    d < rangeStart ? rangeStart : d > rangeEnd ? rangeEnd : d;

  // Per-day cells (one entry for every visible day).
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

  // Month bands (top header row).
  type MonthBand = {
    name: string;
    startPct: number;
    endPct: number;
  };
  const monthBands: MonthBand[] = [];
  {
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur < rangeEnd) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const start = cur < rangeStart ? rangeStart : cur;
      const end = next > rangeEnd ? rangeEnd : next;
      monthBands.push({
        name: formatMonthName(cur),
        startPct: pct(start),
        endPct: pct(end),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  const todayPct = pct(now);
  const showToday = todayPct >= 0 && todayPct <= 100;

  // Bucket bars by channel and assign each to a lane.
  type LaneInfo = { lanes: Map<number, number>; laneCount: number };
  const byChannel = new Map<number, TimelineCampaign[]>();
  for (const c of campaigns) {
    if (!byChannel.has(c.channelId)) byChannel.set(c.channelId, []);
    byChannel.get(c.channelId)!.push(c);
  }
  const laneInfoByChannel = new Map<number, LaneInfo>();
  for (const [channelId, list] of byChannel) {
    laneInfoByChannel.set(channelId, assignLanes(list));
  }

  const isEmpty = groups.length === 0;
  const hasNoCampaigns = campaigns.length === 0;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
      <div className="min-w-[900px]">
        {/* HEADER ----------------------------------------------------------- */}
        <div
          className={`flex border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 ${ROW_BG}`}
        >
          <div
            className={`w-32 sm:w-48 shrink-0 px-4 text-xs font-medium text-zinc-500 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 z-10 ${ROW_BG} flex flex-col justify-end pb-2`}
          >
            Kanál
          </div>
          <div
            className="flex-1 relative select-none"
            style={{
              ...panStyle,
              cursor: panDrag ? "grabbing" : "grab",
              touchAction: "none",
            }}
            title="Táhni vlevo/vpravo pro posun v čase. Shift+táhnout = snap na pondělí. Dvojklik = skok na dnešek."
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={onHeaderPointerCancel}
            onDoubleClick={onHeaderDoubleClick}
          >
            {/* Top sub-row: months */}
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

            {/* Bottom sub-row: per-day or per-week labels */}
            <div className="h-7 relative">
              {compact ? (
                // Per-day cells — number for every day, light highlight on Mondays.
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
                    style={{
                      left: `${d.pct}%`,
                      width: `${dayWidthPct}%`,
                    }}
                  >
                    {d.date.getDate()}
                  </div>
                ))
              ) : (
                // Wide mode: only Monday markers.
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

        {/* BODY ------------------------------------------------------------ */}
        {groups.map((g, gi) => (
          <div
            key={g.id}
            className={
              gi > 0
                ? "border-t-[3px] border-zinc-300 dark:border-zinc-700"
                : ""
            }
          >
            <div
              className={`flex border-b border-zinc-100 dark:border-zinc-800 ${GROUP_HEADER_BG}`}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: buildCountryHeaderMenu(g),
                });
              }}
            >
              <div
                className={`w-32 sm:w-48 shrink-0 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 z-10 ${GROUP_HEADER_BG} flex items-center gap-2`}
              >
                <span className="text-base leading-none">{g.flag}</span>
                <span>{g.name}</span>
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
                    className={`w-32 sm:w-48 shrink-0 px-4 text-sm text-zinc-700 dark:text-zinc-300 border-r border-zinc-100 dark:border-zinc-800 truncate flex items-center sticky left-0 z-10 ${ROW_BG}`}
                    style={{ minHeight: rowHeight }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: buildChannelLabelMenu(ch, g),
                      });
                    }}
                  >
                    {ch.chainName}
                    {info.laneCount > 1 && (
                      <span className="ml-2 text-xs text-zinc-400">
                        ×{info.laneCount}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex-1 relative cursor-copy"
                    style={{ height: rowHeight, ...panStyle }}
                    data-channel-id={ch.id}
                    title="Klikni pro vytvoření kampaně na tomto kanálu/datu"
                    onClick={(e) => {
                      // Only handle clicks on the track itself (which carries
                      // the data-channel-id attribute) — clicks on bars use
                      // their own handlers and don't bubble here meaningfully.
                      if (
                        !(e.target instanceof HTMLElement) ||
                        e.target.dataset.channelId !== String(ch.id)
                      ) {
                        return;
                      }
                      const start = dateAtClick(e.currentTarget, e.clientX);
                      const end = addDays(start, 7);
                      const url = `/campaigns/new?channels=${ch.id}&from=${toDateInputValue(start)}&to=${toDateInputValue(end)}`;
                      window.location.href = url;
                    }}
                    onContextMenu={(e) => {
                      // The bar's own onContextMenu calls stopPropagation,
                      // so this fires only when the user right-clicks empty space.
                      e.preventDefault();
                      setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: buildEmptyTrackMenu(e, ch, g),
                      });
                    }}
                  >
                    {/* Weekend background tint (compact only — meaningless in quarter view) */}
                    {compact &&
                      days
                        .filter((d) => d.isWeekend)
                        .map((d) => (
                          <div
                            key={d.date.toISOString()}
                            className={`absolute top-0 bottom-0 ${WEEKEND_BG} pointer-events-none`}
                            style={{
                              left: `${d.pct}%`,
                              width: `${dayWidthPct}%`,
                            }}
                          />
                        ))}

                    {/* Daily grid (compact mode): subtle on every day, stronger on Mon, strongest on month start */}
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

                    {/* Wide mode: just Monday + month gridlines */}
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
                      // Inclusive end-of-day: bar covers the full last day, so
                      // a campaign "May 1 → May 14" visually spans 14 days.
                      const visualEnd = new Date(b.endsAt.getTime() + ONE_DAY_MS);
                      const right = pct(clamp(visualEnd));
                      const width = Math.max(right - left, 0.5);
                      const laneIdx = info.lanes.get(b.campaignId) ?? 0;
                      const top =
                        ROW_PAD_TOP + laneIdx * (BAR_HEIGHT + LANE_GAP);
                      return (
                        <DraggableBar
                          key={`${b.campaignId}-${b.channelId}`}
                          bar={b}
                          leftPct={left}
                          widthPct={width}
                          top={top}
                          rangeStart={rangeStart}
                          rangeEnd={rangeEnd}
                          now={now}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenu({
                              x: e.clientX,
                              y: e.clientY,
                              items: buildBarMenu(b),
                            });
                          }}
                          onHoverShow={(bar, rect) =>
                            setHoverTooltip({ bar, rect })
                          }
                          onHoverHide={() => setHoverTooltip(null)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {isEmpty && (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            Žádné kanály. Nastav matici v{" "}
            <Link className="underline" href="/admin/channels">
              administraci
            </Link>
            .
          </div>
        )}

        {!isEmpty && hasNoCampaigns && (
          <div className="px-4 py-12 text-center text-sm text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
            Zatím žádné kampaně v tomto rozsahu.{" "}
            <Link className="underline" href="/campaigns/new">
              Vytvoř první
            </Link>
            .
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}

      {hoverTooltip && (
        <CampaignTooltip
          bar={hoverTooltip.bar}
          anchorRect={hoverTooltip.rect}
        />
      )}

      {panPreview && panCursor && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: panCursor.x,
            top: panCursor.y - 36,
            transform: "translateX(-50%)",
          }}
          role="status"
        >
          <div className="rounded-md shadow-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs px-2.5 py-1 font-medium whitespace-nowrap">
            {formatDateShort(panPreview.start)} –{" "}
            {formatDateShort(addDays(panPreview.end, -1))}
            {panPreview.snapped && (
              <span className="ml-1.5 text-[10px] opacity-70">↦ Po</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Floating info card shown on bar hover. Anchored above the bar by default;
 * flips below if it would clip the top of the viewport. Pointer-events are
 * disabled so the tooltip never intercepts clicks/drags on the bar.
 */
function CampaignTooltip({
  bar,
  anchorRect,
}: {
  bar: TimelineCampaign;
  anchorRect: DOMRect;
}) {
  const TOOLTIP_GAP = 8;
  const TOOLTIP_EST_HEIGHT = 130; // approximate; just used to choose flip direction
  const flipBelow = anchorRect.top < TOOLTIP_EST_HEIGHT + TOOLTIP_GAP;
  const top = flipBelow
    ? anchorRect.bottom + TOOLTIP_GAP
    : anchorRect.top - TOOLTIP_GAP;
  const transform = flipBelow ? "translateX(-50%)" : "translate(-50%, -100%)";
  const left = anchorRect.left + anchorRect.width / 2;

  const phase = computeLifecyclePhase(
    bar.startsAt,
    bar.endsAt,
    bar.productReleaseDate ?? null
  );
  const phaseLabel =
    phase === "no-release" ? "" : lifecycleLabel(phase);
  const commLabel = bar.communicationType
    ? communicationTypeLabel(bar.communicationType)
    : "";
  const dur = daysBetween(bar.startsAt, bar.endsAt);
  const isCancelled = bar.status === "cancelled";

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ top, left, transform }}
      role="tooltip"
    >
      <div className="rounded-md shadow-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs min-w-[220px] max-w-[320px]">
        <div className="flex items-start gap-2 mb-1">
          <span
            className="inline-block w-3 h-3 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700 mt-0.5 shrink-0"
            style={{ background: isCancelled ? "#9ca3af" : bar.color }}
          />
          <div className="font-semibold leading-tight text-zinc-900 dark:text-zinc-100 break-words">
            {bar.name}
            {isCancelled && (
              <span className="ml-1 text-zinc-500 font-normal">(zrušeno)</span>
            )}
          </div>
        </div>
        <div className="text-zinc-600 dark:text-zinc-400 leading-snug space-y-0.5">
          <div>
            {formatDate(bar.startsAt)} – {formatDate(bar.endsAt)}{" "}
            <span className="text-zinc-400">
              ({dur} {pluralCs(dur, "den", "dny", "dní")})
            </span>
          </div>
          {(commLabel || phaseLabel) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {commLabel && (
                <span
                  className={
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                    (bar.communicationType
                      ? communicationTypeClasses(bar.communicationType)
                      : "")
                  }
                >
                  {commLabel}
                </span>
              )}
              {phaseLabel && (
                <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 px-1.5 py-0.5 text-[10px] font-medium">
                  {phaseLabel}
                </span>
              )}
            </div>
          )}
          {bar.productReleaseDate && (
            <div className="pt-1">
              <span className="text-zinc-500">⭐ Vydání:</span>{" "}
              {formatDate(bar.productReleaseDate)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type DragMode = "move" | "resize-left" | "resize-right";
type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  deltaPx: number; // already snapped to whole-day pixel grid
  deltaY: number; // raw vertical drag (pixels) — for visual float during move
  msPerPx: number;
  dayWidthPx: number;
};

/**
 * One bar in the timeline with drag-to-move and drag-to-resize.
 *
 * - Pointer down inside the bar (away from edges) = move whole bar
 * - Pointer down within RESIZE_EDGE_PX of left/right = resize that edge
 * - Pointer travel < CLICK_THRESHOLD_PX on release = treat as click → navigate
 *
 * The visual delta during drag is snapped to whole-day increments so the bar
 * jumps in 1-day steps as you drag.
 */
function DraggableBar({
  bar,
  leftPct,
  widthPct,
  top,
  rangeStart,
  rangeEnd,
  now,
  onContextMenu,
  onHoverShow,
  onHoverHide,
}: {
  bar: TimelineCampaign;
  leftPct: number;
  widthPct: number;
  top: number;
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
  onContextMenu?: (e: React.MouseEvent) => void;
  onHoverShow?: (bar: TimelineCampaign, rect: DOMRect) => void;
  onHoverHide?: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [optimistic, setOptimistic] = useState<{
    startsAt: Date;
    endsAt: Date;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function onMouseEnter() {
    if (drag) return;
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (ref.current) {
        onHoverShow?.(bar, ref.current.getBoundingClientRect());
      }
    }, 250);
  }

  function onMouseLeave() {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    onHoverHide?.();
  }

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const pct = (d: Date) =>
    ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
  const clamp = (d: Date) =>
    d < rangeStart ? rangeStart : d > rangeEnd ? rangeEnd : d;

  let displayLeftPct = leftPct;
  let displayWidthPct = widthPct;
  if (optimistic) {
    const visualEnd = new Date(optimistic.endsAt.getTime() + ONE_DAY_MS);
    const l = pct(clamp(optimistic.startsAt));
    const r = pct(clamp(visualEnd));
    displayLeftPct = l;
    displayWidthPct = Math.max(r - l, 0.5);
  }

  let leftPxAdjust = 0;
  let widthPxAdjust = 0;
  let translateX = 0;
  let translateY = 0;
  if (drag) {
    if (drag.mode === "move") {
      translateX = drag.deltaPx;
      translateY = drag.deltaY;
    } else if (drag.mode === "resize-left") {
      leftPxAdjust = drag.deltaPx;
      widthPxAdjust = -drag.deltaPx;
    } else {
      widthPxAdjust = drag.deltaPx;
    }
  }

  function detectMode(e: React.PointerEvent): DragMode {
    const rect = ref.current!.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    if (offsetX < RESIZE_EDGE_PX) return "resize-left";
    if (offsetX > rect.width - RESIZE_EDGE_PX) return "resize-right";
    return "move";
  }

  function onPointerDown(e: React.PointerEvent) {
    // Only left mouse button starts a drag — right-click goes through to
    // onContextMenu, middle-click etc. is ignored.
    if (e.button !== 0) return;
    if (isPending) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const mode = detectMode(e);
    const trackEl = target.parentElement!;
    const trackWidth = trackEl.getBoundingClientRect().width;
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const msPerPx = totalMs / trackWidth;
    const dayWidthPx = ONE_DAY_MS / msPerPx;

    setDrag({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      deltaPx: 0,
      deltaY: 0,
      msPerPx,
      dayWidthPx,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const rawDelta = e.clientX - drag.startX;
    const snapped =
      Math.round(rawDelta / drag.dayWidthPx) * drag.dayWidthPx;
    const newDeltaY =
      drag.mode === "move" ? e.clientY - drag.startY : drag.deltaY;
    if (snapped === drag.deltaPx && newDeltaY === drag.deltaY) return;
    setDrag({ ...drag, deltaPx: snapped, deltaY: newDeltaY });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const target = e.currentTarget;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }

    const rawDelta = e.clientX - drag.startX;
    const rawDeltaY = e.clientY - drag.startY;
    const { mode, msPerPx, deltaPx } = drag;
    setDrag(null);

    if (
      Math.abs(rawDelta) < CLICK_THRESHOLD_PX &&
      Math.abs(rawDeltaY) < CLICK_THRESHOLD_PX
    ) {
      router.push(`/campaigns/${bar.campaignId}`);
      return;
    }

    // Did the bar move to a different channel row? Only meaningful for "move".
    let newChannelId: number | null = null;
    if (mode === "move" && Math.abs(rawDeltaY) >= CLICK_THRESHOLD_PX) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        const channelEl = (el as HTMLElement).closest(
          "[data-channel-id]"
        ) as HTMLElement | null;
        if (channelEl) {
          const id = Number(channelEl.dataset.channelId);
          if (Number.isFinite(id) && id !== bar.channelId) {
            newChannelId = id;
          }
        }
      }
    }

    const deltaMs = Math.round((deltaPx * msPerPx) / ONE_DAY_MS) * ONE_DAY_MS;

    let newStart = bar.startsAt.getTime();
    let newEnd = bar.endsAt.getTime();
    if (mode === "move") {
      newStart += deltaMs;
      newEnd += deltaMs;
    } else if (mode === "resize-left") {
      newStart = Math.min(newStart + deltaMs, newEnd);
    } else {
      newEnd = Math.max(newEnd + deltaMs, newStart);
    }

    const newStartDate = new Date(newStart);
    const newEndDate = new Date(newEnd);
    const datesChanged = deltaMs !== 0;

    if (!datesChanged && newChannelId === null) return;

    setOptimistic({ startsAt: newStartDate, endsAt: newEndDate });
    startTransition(async () => {
      try {
        if (datesChanged) {
          await moveCampaign(bar.campaignId, newStartDate, newEndDate);
        }
        if (newChannelId !== null) {
          await moveCampaignToChannel(
            bar.campaignId,
            bar.channelId,
            newChannelId
          );
        }
      } finally {
        setOptimistic(null);
      }
    });
  }

  function onPointerCancel(e: React.PointerEvent) {
    if (!drag) return;
    const target = e.currentTarget;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    setDrag(null);
  }

  const cursor =
    drag?.mode === "resize-left" || drag?.mode === "resize-right"
      ? "ew-resize"
      : drag?.mode === "move"
        ? "grabbing"
        : "grab";

  const start = optimistic?.startsAt ?? bar.startsAt;
  const end = optimistic?.endsAt ?? bar.endsAt;
  const duration = daysBetween(start, end);

  // Progress overlay for currently-running campaigns. The dark overlay covers
  // 0..elapsedRatio of the bar so you instantly see "campaign is 60% done".
  const isCurrentlyRunning =
    bar.status === "approved" &&
    now.getTime() >= start.getTime() &&
    now.getTime() <= end.getTime() + ONE_DAY_MS; // inclusive last day
  const totalSpanMs = end.getTime() + ONE_DAY_MS - start.getTime();
  const elapsedRatio =
    isCurrentlyRunning && totalSpanMs > 0
      ? Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / totalSpanMs))
      : 0;

  // Visual treatment per status: cancelled = grayed and struck-through.
  // Active (the only other state in current data) = solid bar.
  const isCancelled = bar.status === "cancelled";
  const baseOpacity = isCancelled ? 0.45 : 1;
  const dragOpacity = drag || isPending ? baseOpacity * 0.85 : baseOpacity;
  const background = isCancelled ? "#9ca3af" : bar.color;
  const outline = isCancelled ? "1px solid #9ca3af" : undefined;

  const statusTitle = isCancelled ? " · ZRUŠENO" : "";

  // Lifecycle phase (campaign dates × product release) — shown in tooltip and
  // drives the in-bar release-date star marker below.
  const lifecyclePhase = computeLifecyclePhase(
    start,
    end,
    bar.productReleaseDate ?? null
  );
  const phaseLabel =
    lifecyclePhase === "no-release" ? "" : lifecycleLabel(lifecyclePhase);
  const commLabel = bar.communicationType
    ? communicationTypeLabel(bar.communicationType)
    : "";
  const tooltipExtras = [commLabel, phaseLabel].filter(Boolean).join(" · ");

  // Position the release-date marker as a percentage of the bar's own width.
  // We only show it when the release falls inside [start, end+1day] — outside
  // that the lifecycle badge in the tooltip is already explanatory.
  let releaseMarkerPct: number | null = null;
  if (bar.productReleaseDate) {
    const r = bar.productReleaseDate.getTime();
    const s = start.getTime();
    const e = end.getTime() + ONE_DAY_MS;
    if (r >= s && r <= e && e > s) {
      releaseMarkerPct = ((r - s) / (e - s)) * 100;
    }
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute text-white text-xs px-2 rounded flex items-center overflow-hidden select-none transition-shadow z-[1]"
      style={{
        left: `calc(${displayLeftPct}% + ${leftPxAdjust}px)`,
        width: `calc(${displayWidthPct}% + ${widthPxAdjust}px)`,
        minWidth: BAR_MIN_WIDTH_PX,
        top: `${top}px`,
        height: `${BAR_HEIGHT}px`,
        background,
        cursor,
        transform:
          translateX !== 0 || translateY !== 0
            ? `translate(${translateX}px, ${translateY}px)`
            : undefined,
        zIndex: drag ? 50 : undefined,
        opacity: dragOpacity,
        boxShadow: drag ? "0 4px 12px rgba(0,0,0,0.25)" : undefined,
        outline,
        color: "white",
        textDecoration: isCancelled ? "line-through" : undefined,
        touchAction: "none",
      }}
      aria-label={`${bar.name}${statusTitle} · ${formatDate(start)} – ${formatDate(end)}${tooltipExtras ? ` · ${tooltipExtras}` : ""}`}
    >
      {/* Progress overlay (elapsed portion) — sits behind handles + content */}
      {elapsedRatio > 0 && !isCancelled && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 bg-black/30 pointer-events-none"
          style={{ width: `${elapsedRatio * 100}%` }}
        />
      )}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ width: RESIZE_EDGE_PX, cursor: "ew-resize" }}
      />
      <span
        aria-hidden
        className="absolute right-0 top-0 bottom-0"
        style={{ width: RESIZE_EDGE_PX, cursor: "ew-resize" }}
      />
      {bar.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bar.coverUrl}
          alt=""
          className="w-4 h-4 rounded-sm object-cover shrink-0 mr-1 ring-1 ring-white/30 pointer-events-none"
          loading="lazy"
        />
      )}
      <span className="truncate pointer-events-none px-0.5 font-medium">
        {bar.name}
      </span>
      {releaseMarkerPct !== null && (
        <span
          aria-hidden
          className="absolute top-0 bottom-0 pointer-events-none flex items-center"
          style={{ left: `${releaseMarkerPct}%`, transform: "translateX(-50%)" }}
        >
          <span
            className="text-[11px] leading-none drop-shadow"
            title="Vydání produktu"
          >
            ⭐
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Greedy first-fit lane assignment. Sorts bars by start date (longer first on
 * ties so they grab the top lane), then walks through them placing each into
 * the first lane whose last bar ended before this one starts.
 *
 * Optimal for "interval graph coloring" — produces the minimum number of lanes.
 */
function assignLanes(bars: TimelineCampaign[]): {
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
