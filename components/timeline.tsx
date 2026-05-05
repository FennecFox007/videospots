"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  moveCampaign,
  moveCampaignToChannel,
  cancelCampaign,
  reactivateCampaign,
  cloneCampaign,
  archiveCampaign,
  createCampaignShareLink,
  approveCampaign,
  clearCampaignApproval,
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
} from "@/lib/communication";
import { useT } from "@/lib/i18n/client";
import { localizedCountryName } from "@/lib/i18n/country";
import { openCampaignPeek } from "@/lib/peek-store";
import {
  getCurrentDrag,
  setPendingDrop,
  SPOT_DRAG_MIME,
  type SpotDragPayload,
} from "@/lib/spot-drop-store";
import { ChannelOverrideDialog } from "@/components/channel-override-dialog";
import { useDialog } from "@/components/dialog/dialog-provider";
import { EmptyState } from "@/components/ui/empty-state";

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
  /** Communication intent (preorder/launch/outnow/...). Shown in tooltip.
   *  Null when not set. */
  communicationType: string | null;
  /** Trailer / spot URL. When present, the bar renders a small play button
   *  that opens the video in a modal without navigating away from timeline. */
  videoUrl: string | null;
  /** Product cover image URL (joined from product table). Optional thumbnail. */
  coverUrl: string | null;
  /** EFFECTIVE start/end — already coalesced from per-channel override over
   *  master campaign dates in fetchTimelineCampaigns. The bar should render
   *  these as-is. */
  startsAt: Date;
  endsAt: Date;
  /** Master campaign start/end. Same for every bar of the same campaign,
   *  regardless of per-channel overrides. The override dialog needs them
   *  to show "campaign-wide dates" for reference. */
  masterStartsAt: Date;
  masterEndsAt: Date;
  /** Set when this ONE channel is cancelled (independent of campaign-level
   *  status). Bar reads as cancelled if EITHER status='cancelled' OR this
   *  is set. */
  channelCancelledAt: Date | null;
  /** True when at least one of (startsAt / endsAt / cancelledAt) on the
   *  campaign_channel row is non-null. Drives the small visual indicator
   *  on the bar. */
  hasChannelOverride: boolean;
  /** Client approval timestamp. Null = waiting for approval — bar gets
   *  diagonal stripes overlay so the agency sees at a glance which
   *  campaigns the client hasn't blessed yet. Permanent once set; further
   *  edits don't invalidate (per partner). */
  clientApprovedAt: Date | null;
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
//
// Two density presets — "comfort" (default) keeps the legacy generous spacing,
// "compact" trims everything down so a heavily-stacked timeline (lots of
// channels × many lanes) fits the viewport without scrolling. The toggle in
// the timeline chrome flips between them; the choice persists per user via
// localStorage.
const BAR_MIN_WIDTH_PX = 24; // make 1-day bars clickable instead of hairlines
const RESIZE_EDGE_PX = 8;
const CLICK_THRESHOLD_PX = 5;
const ONE_DAY_MS = 86_400_000;

type Density = "comfort" | "compact";

type DensityPreset = {
  barHeight: number;
  laneGap: number;
  rowPadTop: number;
  rowPadBottom: number;
  /** Bar text size class. */
  barFont: string;
  /** Bar inner horizontal padding class. */
  barPx: string;
  /** Render the per-bar product cover thumbnail? */
  showCover: boolean;
  /** Country header (group row) padding-y class. */
  countryHeaderPy: string;
  /** Country header text size class. */
  countryHeaderText: string;
  /** Channel-label cell text size class. */
  channelLabelText: string;
};

const DENSITY: Record<Density, DensityPreset> = {
  comfort: {
    barHeight: 28,
    laneGap: 4,
    rowPadTop: 4,
    rowPadBottom: 4,
    barFont: "text-xs",
    barPx: "px-2",
    showCover: true,
    countryHeaderPy: "py-2.5",
    countryHeaderText: "text-sm",
    channelLabelText: "text-sm",
  },
  compact: {
    barHeight: 20,
    laneGap: 2,
    rowPadTop: 2,
    rowPadBottom: 2,
    barFont: "text-[10px]",
    barPx: "px-1",
    showCover: false,
    countryHeaderPy: "py-1",
    countryHeaderText: "text-xs",
    channelLabelText: "text-xs",
  },
};

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
  const t = useT();
  const { toast } = useDialog();
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

  // Live placement preview while dragging a spot from <SpotsDrawer> over
  // a channel row. channelId tells which row to render the ghost on;
  // startPct/widthPct control its position. spotName is shown inside the
  // ghost. Updates on every onDragOver, cleared on document `dragend`.
  const [dragPreview, setDragPreview] = useState<{
    channelId: number;
    startPct: number;
    widthPct: number;
    startDate: Date;
    endDate: Date;
    spotName: string;
  } | null>(null);

  // Clear placement preview whenever ANY drag ends (drop or cancel).
  // dragend fires on the source (spot card in the drawer); using a
  // document-level listener catches both branches without coupling.
  useEffect(() => {
    function onDragEnd() {
      setDragPreview(null);
    }
    document.addEventListener("dragend", onDragEnd);
    return () => document.removeEventListener("dragend", onDragEnd);
  }, []);

  // Per-channel override dialog target. Null = closed; an object opens the
  // dialog scoped to that (campaign × channel) pair. We carry the channel +
  // country alongside the bar so the dialog title can show "for <chain>
  // (<country>)" without an extra lookup.
  const [overrideTarget, setOverrideTarget] = useState<{
    bar: TimelineCampaign;
    channel: TimelineChannel;
    country: TimelineCountryGroup;
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

  // ---------------------------------------------------------------------------
  // Collapsible country groups: per-user UI preference, stored in localStorage
  // (not URL — collapse is layout, not data filter; saved views shouldn't carry
  // it). Server always renders everything expanded; on mount we read storage
  // and re-render with whatever the user last had collapsed. Brief flash on
  // first load is acceptable for a UI toggle.
  // ---------------------------------------------------------------------------
  const COLLAPSE_STORAGE_KEY = "videospots:timeline:collapsed";
  const DENSITY_STORAGE_KEY = "videospots:timeline:density";
  const [collapsedCountries, setCollapsedCountries] = useState<Set<string>>(
    new Set()
  );
  const [density, setDensity] = useState<Density>("comfort");
  const dp = DENSITY[density];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCollapsedCountries(
            new Set(parsed.filter((x): x is string => typeof x === "string"))
          );
        }
      }
    } catch {
      // Bad JSON or no localStorage — ignore.
    }
    try {
      const d = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (d === "compact" || d === "comfort") setDensity(d);
    } catch {
      // ignore
    }
  }, []);

  function persistDensity(next: Density) {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function persistCollapsed(next: Set<string>) {
    setCollapsedCountries(next);
    try {
      localStorage.setItem(
        COLLAPSE_STORAGE_KEY,
        JSON.stringify(Array.from(next))
      );
    } catch {
      // Quota or privacy mode — silently skip persistence.
    }
  }

  function toggleCountryCollapsed(code: string) {
    const next = new Set(collapsedCountries);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    persistCollapsed(next);
  }

  function collapseAllExcept(code: string) {
    persistCollapsed(
      new Set(groups.filter((g) => g.code !== code).map((g) => g.code))
    );
  }

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
    const countryLabel = localizedCountryName(
      country.code,
      country.name,
      t.locale
    );
    return [
      {
        kind: "link",
        label: t("ctx.create_here", {
          chain: channel.chainName,
          date: formatDateShort(start),
        }),
        href: baseUrl([channel.id]),
      },
      {
        kind: "link",
        label: t("ctx.create_for_country", { country: countryLabel }),
        href: baseUrl(allCountryChannels),
      },
      { kind: "separator" },
      {
        kind: "link",
        label: t("ctx.filter_chain", { chain: channel.chainName }),
        href: `?chain=${encodeURIComponent(channel.chainCode)}`,
      },
      {
        kind: "link",
        label: t("ctx.filter_country", { country: countryLabel }),
        href: `?country=${encodeURIComponent(country.code)}`,
      },
    ];
  }

  async function shareForApproval(campaignId: number) {
    try {
      const url = await createCampaignShareLink(campaignId);
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("ctx.share_for_approval_copied"));
      } catch {
        // Clipboard might be blocked (e.g. http context). Fall back to a
        // hidden textarea + execCommand("copy") — same trick share-button
        // uses. Worst case the toast tells the user to copy manually.
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          toast.success(t("ctx.share_for_approval_copied"));
        } catch {
          toast.info(url);
        }
        ta.remove();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function buildBarMenu(
    bar: TimelineCampaign,
    channel: TimelineChannel,
    country: TimelineCountryGroup
  ): ContextMenuItem[] {
    const isCancelled = bar.status === "cancelled";
    return [
      {
        kind: "link",
        label: t("ctx.open_detail"),
        href: `/campaigns/${bar.campaignId}`,
      },
      {
        kind: "link",
        label: t("ctx.edit"),
        href: `/campaigns/${bar.campaignId}/edit`,
      },
      {
        kind: "action",
        label: t("ctx.edit_for_channel"),
        onClick: () =>
          setOverrideTarget({ bar, channel, country }),
      },
      // Approval is auth-gated. Anyone logged in can approve or unapprove
      // via this menu — same effect as the button in the peek footer or on
      // the detail page. The label flips depending on current state.
      // router.refresh() afterwards forces this server-rendered timeline
      // page to reload its data, so the bar's stripes (un)appear without
      // the user having to navigate.
      {
        kind: "action",
        label: bar.clientApprovedAt
          ? t("ctx.unapprove")
          : t("ctx.approve"),
        onClick: async () => {
          if (bar.clientApprovedAt) {
            await clearCampaignApproval(bar.campaignId);
          } else {
            await approveCampaign(bar.campaignId);
          }
          router.refresh();
        },
      },
      {
        kind: "action",
        label: t("ctx.share_link"),
        onClick: () => shareForApproval(bar.campaignId),
      },
      { kind: "separator" },
      {
        kind: "action",
        label: t("ctx.shift_week_back"),
        onClick: () => shiftBar(bar, -7),
      },
      {
        kind: "action",
        label: t("ctx.shift_week_forward"),
        onClick: () => shiftBar(bar, 7),
      },
      { kind: "separator" },
      {
        kind: "action",
        label: t("ctx.clone"),
        onClick: () => cloneCampaign(bar.campaignId),
      },
      {
        kind: "action",
        label: isCancelled ? t("ctx.reactivate") : t("ctx.cancel_historic"),
        onClick: () =>
          isCancelled
            ? reactivateCampaign(bar.campaignId)
            : cancelCampaign(bar.campaignId),
      },
      { kind: "separator" },
      {
        kind: "action",
        label: t("ctx.archive"),
        destructive: true,
        onClick: () => archiveCampaign(bar.campaignId),
      },
    ];
  }

  function buildChannelLabelMenu(
    channel: TimelineChannel,
    country: TimelineCountryGroup
  ): ContextMenuItem[] {
    const countryLabel = localizedCountryName(
      country.code,
      country.name,
      t.locale
    );
    return [
      {
        kind: "link",
        label: t("ctx.create_for_chain", { chain: channel.chainName }),
        href: `/campaigns/new?channels=${channel.id}`,
      },
      {
        kind: "link",
        label: t("ctx.create_for_country", { country: countryLabel }),
        href: `/campaigns/new?channels=${country.channels.map((c) => c.id).join(",")}`,
      },
      { kind: "separator" },
      {
        kind: "link",
        label: t("ctx.filter_chain", { chain: channel.chainName }),
        href: `?chain=${encodeURIComponent(channel.chainCode)}`,
      },
    ];
  }

  function buildCountryHeaderMenu(
    country: TimelineCountryGroup
  ): ContextMenuItem[] {
    const isCollapsed = collapsedCountries.has(country.code);
    const countryLabel = localizedCountryName(
      country.code,
      country.name,
      t.locale
    );
    return [
      {
        kind: "action",
        label: isCollapsed ? t("ctx.expand") : t("ctx.collapse"),
        onClick: () => toggleCountryCollapsed(country.code),
      },
      {
        kind: "action",
        label: t("ctx.focus_country"),
        onClick: () => collapseAllExcept(country.code),
      },
      { kind: "separator" },
      {
        kind: "link",
        label: t("ctx.create_for_country", { country: countryLabel }),
        href: `/campaigns/new?channels=${country.channels.map((c) => c.id).join(",")}`,
      },
      { kind: "separator" },
      {
        kind: "link",
        label: t("ctx.filter_country", { country: countryLabel }),
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
        name: formatMonthName(cur, t.locale === "en" ? "en-US" : "cs-CZ"),
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
    <div className="space-y-2">
      {/* Density toggle — flips bar/header sizes for dense timelines. State
          persists in localStorage so the user's choice carries across pages. */}
      <div className="flex items-center justify-end gap-2 text-xs text-zinc-500">
        <span>{t("timeline.density")}:</span>
        <div
          className="inline-flex rounded-md ring-1 ring-zinc-300 dark:ring-zinc-700 overflow-hidden font-medium"
          role="group"
          aria-label={t("timeline.density")}
        >
          {(["comfort", "compact"] as const).map((d, i) => {
            const active = density === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => persistDensity(d)}
                aria-pressed={active}
                className={
                  "px-2 py-1 transition-colors " +
                  (active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800") +
                  (i === 0
                    ? ""
                    : " border-l border-zinc-200 dark:border-zinc-700")
                }
              >
                {t(d === "comfort" ? "timeline.density.comfort" : "timeline.density.compact")}
              </button>
            );
          })}
        </div>
      </div>

    <div className="rounded-lg bg-white dark:bg-zinc-900 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 shadow-sm overflow-x-auto">
      <div className="min-w-[900px]">
        {/* HEADER ----------------------------------------------------------- */}
        <div
          className={`flex border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 ${ROW_BG}`}
        >
          <div
            className={`w-32 sm:w-48 shrink-0 px-4 text-xs font-medium text-zinc-500 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 z-10 ${ROW_BG} flex flex-col justify-end pb-2`}
          >
            {t("timeline.channel_col")}
          </div>
          <div
            className="flex-1 relative select-none"
            style={{
              ...panStyle,
              cursor: panDrag ? "grabbing" : "grab",
              touchAction: "none",
            }}
            title={t("timeline.tip")}
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
                    {t("timeline.now_marker")}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* BODY ------------------------------------------------------------ */}
        {groups.map((g, gi) => {
          const isCollapsed = collapsedCountries.has(g.code);
          // Distinct campaign IDs across this country's channels in the
          // visible range — shown as "X kampaní" when the group is collapsed
          // so the user knows there's content under the fold.
          const aggCampaignIds = new Set<number>();
          for (const ch of g.channels) {
            const list = byChannel.get(ch.id) ?? [];
            for (const b of list) aggCampaignIds.add(b.campaignId);
          }
          const aggCount = aggCampaignIds.size;

          return (
          <div
            key={g.id}
            className={
              gi > 0
                ? "border-t-[3px] border-zinc-300 dark:border-zinc-700"
                : ""
            }
          >
            <div
              role="button"
              aria-expanded={!isCollapsed}
              aria-label={localizedCountryName(g.code, g.name, t.locale)}
              className={`flex border-b border-zinc-100 dark:border-zinc-800 ${GROUP_HEADER_BG} cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors`}
              onClick={() => toggleCountryCollapsed(g.code)}
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
                className={`w-32 sm:w-48 shrink-0 px-4 ${dp.countryHeaderPy} ${dp.countryHeaderText} font-semibold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 z-10 ${GROUP_HEADER_BG} flex items-center gap-2`}
              >
                <span
                  aria-hidden
                  className={
                    "text-zinc-400 dark:text-zinc-500 text-xs w-3 inline-block transition-transform " +
                    (isCollapsed ? "" : "rotate-90")
                  }
                >
                  ▸
                </span>
                <span className="text-base leading-none">{g.flag}</span>
                <span>{localizedCountryName(g.code, g.name, t.locale)}</span>
              </div>
              <div className="flex-1 flex items-center px-3">
                {isCollapsed && aggCount > 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    {aggCount}{" "}
                    {pluralCs(aggCount, "kampaň", "kampaně", "kampaní")}
                    {" · "}
                    {g.channels.length}{" "}
                    {pluralCs(
                      g.channels.length,
                      "kanál",
                      "kanály",
                      "kanálů"
                    )}
                  </span>
                )}
              </div>
            </div>

            {!isCollapsed &&
              g.channels.map((ch) => {
              const bars = byChannel.get(ch.id) ?? [];
              const info =
                laneInfoByChannel.get(ch.id) ??
                ({ lanes: new Map(), laneCount: 1 } as LaneInfo);
              // While dragging a spot over THIS row, reserve an extra lane at
              // the bottom so the ghost can sit there cleanly without covering
              // existing bars. The row gets taller, which naturally pushes the
              // channels below it down — visual cue that "room is being made".
              const isDragTarget =
                dragPreview !== null && dragPreview.channelId === ch.id;
              const displayLaneCount =
                info.laneCount + (isDragTarget ? 1 : 0);
              const rowHeight =
                dp.rowPadTop +
                displayLaneCount * dp.barHeight +
                Math.max(0, displayLaneCount - 1) * dp.laneGap +
                dp.rowPadBottom;

              return (
                <div
                  key={ch.id}
                  className="flex border-b border-zinc-100 dark:border-zinc-800"
                >
                  <div
                    className={`w-32 sm:w-48 shrink-0 px-4 ${dp.channelLabelText} text-zinc-700 dark:text-zinc-300 border-r border-zinc-100 dark:border-zinc-800 truncate flex items-center sticky left-0 z-10 transition-[min-height] duration-150 ${ROW_BG}`}
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
                    className="flex-1 relative cursor-copy transition-[height] duration-150"
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
                    // HTML5 drag-and-drop landing for spots dragged from the
                    // <SpotsDrawer />. Accepts only our custom MIME and only
                    // when the spot's country matches this channel's country.
                    // The drop handler reads the payload, computes the date
                    // from the cursor x within the track, and pushes a
                    // PendingDrop into spot-drop-store, which the modal
                    // mounted at page level reacts to.
                    onDragOver={(e) => {
                      // `types` can be either Array or DOMStringList depending
                      // on the browser; iterate manually so .includes() not
                      // being on the prototype isn't fatal.
                      const types = e.dataTransfer.types;
                      let hasMime = false;
                      for (let i = 0; i < types.length; i++) {
                        if (types[i] === SPOT_DRAG_MIME) {
                          hasMime = true;
                          break;
                        }
                      }
                      if (!hasMime) return;
                      e.preventDefault();
                      // Country match? If yes, allow drop + paint ghost
                      // preview; if no, set dropEffect="none" so the cursor
                      // shows the not-allowed marker and skip the preview.
                      const dragging = getCurrentDrag();
                      if (!dragging || dragging.countryId !== g.id) {
                        e.dataTransfer.dropEffect = "none";
                        return;
                      }
                      e.dataTransfer.dropEffect = "copy";
                      // Snap drop date to whole day, then build a 14-day
                      // ghost bar starting there. visual "endDate" is +14
                      // days exclusive (matches how bars get rendered:
                      // start..end+1d as percentage). The modal default is
                      // 14 days, kept consistent so the preview matches
                      // what you'll see post-drop.
                      const startDate = dateAtClick(e.currentTarget, e.clientX);
                      const visualEnd = addDays(startDate, 14);
                      const startPct = pct(clamp(startDate));
                      const endPct = pct(clamp(visualEnd));
                      setDragPreview({
                        channelId: ch.id,
                        startPct,
                        widthPct: Math.max(endPct - startPct, 0.5),
                        startDate,
                        endDate: addDays(startDate, 13),
                        spotName: dragging.spotName,
                      });
                    }}
                    onDrop={(e) => {
                      const raw = e.dataTransfer.getData(SPOT_DRAG_MIME);
                      if (!raw) return;
                      e.preventDefault();
                      setDragPreview(null);
                      let payload: SpotDragPayload;
                      try {
                        payload = JSON.parse(raw) as SpotDragPayload;
                      } catch {
                        return;
                      }
                      if (payload.countryId !== g.id) {
                        toast.error(
                          t("spot_drop.country_mismatch", {
                            spot: payload.countryCode,
                            target: g.code,
                          })
                        );
                        return;
                      }
                      const startDate = dateAtClick(
                        e.currentTarget,
                        e.clientX
                      );
                      setPendingDrop({
                        spotId: payload.spotId,
                        spotName: payload.spotName,
                        spotProductName: payload.spotProductName,
                        countryId: g.id,
                        countryCode: g.code,
                        countryFlag: g.flag,
                        countryName: g.name,
                        channelId: ch.id,
                        channelName: ch.chainName,
                        startDate,
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
                        dp.rowPadTop + laneIdx * (dp.barHeight + dp.laneGap);
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
                              items: buildBarMenu(b, ch, g),
                            });
                          }}
                          onHoverShow={(bar, rect) =>
                            setHoverTooltip({ bar, rect })
                          }
                          onHoverHide={() => setHoverTooltip(null)}
                          density={dp}
                        />
                      );
                    })}

                    {/* Ghost preview while dragging a spot from <SpotsDrawer />.
                     *  Sits at the BOTTOM of the row in a freshly reserved lane
                     *  (the row was already grown by displayLaneCount above),
                     *  so existing bars are never covered — the new spot is
                     *  visibly "added below". The actual lane assignment after
                     *  drop is still up to the stacking algorithm; this is a
                     *  date + placement hint, deliberately matching the user's
                     *  mental model of "drop = new lane below." */}
                    {dragPreview && dragPreview.channelId === ch.id && (
                      <>
                        <div
                          aria-hidden
                          className="absolute rounded border-2 border-dashed border-indigo-500 bg-indigo-500/20 dark:bg-indigo-400/20 pointer-events-none flex items-center px-2 overflow-hidden z-[2]"
                          style={{
                            left: `${dragPreview.startPct}%`,
                            width: `${dragPreview.widthPct}%`,
                            top: `${dp.rowPadTop + info.laneCount * (dp.barHeight + dp.laneGap)}px`,
                            height: `${dp.barHeight}px`,
                          }}
                        >
                          <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-200 truncate">
                            {dragPreview.spotName}
                          </span>
                        </div>
                        {/* Floating date pill above the ghost — shows the exact
                         *  range + day count in CZ format so the user reads the
                         *  drop date without squinting at gridlines. */}
                        <div
                          aria-hidden
                          className="absolute -translate-x-1/2 px-2 py-0.5 rounded bg-indigo-600 text-white text-[11px] font-medium shadow pointer-events-none whitespace-nowrap z-[3]"
                          style={{
                            left: `${dragPreview.startPct + dragPreview.widthPct / 2}%`,
                            top: `${dp.rowPadTop + info.laneCount * (dp.barHeight + dp.laneGap) - 22}px`,
                          }}
                        >
                          {formatDate(dragPreview.startDate)} – {formatDate(dragPreview.endDate)}{" "}
                          <span className="opacity-75">
                            (14 {pluralCs(14, "den", "dny", "dní")})
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          );
        })}

        {isEmpty && (
          // Embedded inside the timeline scrollbox — drop the dashed border
          // since the parent already provides framing.
          <EmptyState
            variant="plain"
            description={
              <>
                {t("timeline.no_channels")}{" "}
                <Link className="underline" href="/admin/channels">
                  {t("timeline.no_channels_link")}
                </Link>
                .
              </>
            }
          />
        )}

        {!isEmpty && hasNoCampaigns && (
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            <EmptyState
              variant="plain"
              description={
                <>
                  {t("timeline.no_campaigns_in_range")}{" "}
                  <Link className="underline" href="/campaigns/new">
                    {t("timeline.create_first")}
                  </Link>
                  .
                </>
              }
            />
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
              <span className="ml-1.5 text-[10px] opacity-70">
                {t("timeline.preview_snap_monday")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Per-channel override dialog. Only mounted when a target is set; closing
        unmounts it so the dialog state resets cleanly between bars. */}
    {overrideTarget && (
      <ChannelOverrideDialog
        open
        campaignId={overrideTarget.bar.campaignId}
        channelId={overrideTarget.bar.channelId}
        chainName={overrideTarget.channel.chainName}
        countryName={localizedCountryName(
          overrideTarget.country.code,
          overrideTarget.country.name,
          t.locale
        )}
        countryFlag={overrideTarget.country.flag}
        effectiveStartsAt={overrideTarget.bar.startsAt}
        effectiveEndsAt={overrideTarget.bar.endsAt}
        masterStartsAt={overrideTarget.bar.masterStartsAt}
        masterEndsAt={overrideTarget.bar.masterEndsAt}
        cancelled={overrideTarget.bar.channelCancelledAt !== null}
        hasOverride={overrideTarget.bar.hasChannelOverride}
        onClose={() => setOverrideTarget(null)}
      />
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
  const TOOLTIP_EST_HEIGHT = 110; // approximate; just used to choose flip direction
  const flipBelow = anchorRect.top < TOOLTIP_EST_HEIGHT + TOOLTIP_GAP;
  const top = flipBelow
    ? anchorRect.bottom + TOOLTIP_GAP
    : anchorRect.top - TOOLTIP_GAP;
  const transform = flipBelow ? "translateX(-50%)" : "translate(-50%, -100%)";
  const left = anchorRect.left + anchorRect.width / 2;

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
          {commLabel && (
            <div className="pt-1">
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
  density,
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
  density: DensityPreset;
}) {
  const t = useT();
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
    // Bars with a per-channel override are not draggable: drag updates
    // campaign master dates (moving every retailer together), which would
    // silently move every other channel and leave the override stranded.
    // Skip the drag setup entirely; the bar's onClick still fires on
    // pointerup and opens the peek panel — same as a click on a regular
    // bar. To re-enable drag, the user clears the override via
    // "Smazat přepsání" in the override dialog.
    if (bar.hasChannelOverride) return;
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
      // Open the right-side peek panel (mounted at root layout). This used
      // to be a router.push to /campaigns/<id> caught by an intercepting
      // route, but Turbopack + parallel slots + intercepts kept crashing
      // the dev server. Now it's just an imperative call into a tiny
      // module-level store; no routing involved.
      openCampaignPeek(bar.campaignId);
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

  const cursor = bar.hasChannelOverride
    ? "pointer"
    : drag?.mode === "resize-left" || drag?.mode === "resize-right"
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
  // "cancelled" here is the union of campaign-level cancel and per-channel
  // cancel — both render the same way (a struck-through gray bar). The
  // distinction matters for the menu (cancel/reactivate apply to the campaign
  // as a whole, not per-channel; the dialog handles per-channel cancellation
  // separately) but not for visual styling.
  const isCancelled =
    bar.status === "cancelled" || bar.channelCancelledAt !== null;
  const baseOpacity = isCancelled ? 0.45 : 1;
  const dragOpacity = drag || isPending ? baseOpacity * 0.85 : baseOpacity;
  const background = isCancelled ? "#9ca3af" : bar.color;
  const outline = isCancelled ? "1px solid #9ca3af" : undefined;

  const statusTitle = isCancelled ? " · ZRUŠENO" : "";

  const commLabel = bar.communicationType
    ? communicationTypeLabel(bar.communicationType)
    : "";

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
      // Override bars skip the drag pipeline (see onPointerDown), so they
      // don't reach the click-detection branch in onPointerUp. Use the
      // browser's onClick instead — same outcome (open peek), without
      // accidentally enabling drag for these locked bars.
      onClick={(e) => {
        if (!bar.hasChannelOverride) return;
        // Don't let it bubble through the play-button anchor's container
        // and open the peek twice.
        if (e.defaultPrevented) return;
        openCampaignPeek(bar.campaignId);
      }}
      className={`absolute text-white ${density.barFont} ${density.barPx} rounded flex items-center overflow-hidden select-none transition-shadow z-[1]`}
      style={{
        left: `calc(${displayLeftPct}% + ${leftPxAdjust}px)`,
        width: `calc(${displayWidthPct}% + ${widthPxAdjust}px)`,
        minWidth: BAR_MIN_WIDTH_PX,
        top: `${top}px`,
        height: `${density.barHeight}px`,
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
      aria-label={`${bar.name}${statusTitle} · ${formatDate(start)} – ${formatDate(end)}${commLabel ? ` · ${commLabel}` : ""}`}
    >
      {/* Progress overlay (elapsed portion) — sits behind handles + content */}
      {elapsedRatio > 0 && !isCancelled && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 bg-black/30 pointer-events-none"
          style={{ width: `${elapsedRatio * 100}%` }}
        />
      )}
      {/* Diagonal stripes — campaign hasn't been client-approved yet. The
          stripes sit on top of the campaign colour but below the text/icons
          (transparent layer, non-interactive). Skipped for cancelled bars
          since their gray + line-through is already a stronger signal. */}
      {!bar.clientApprovedAt && !isCancelled && (
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          title="Čeká na schválení klienta"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0, transparent 6px, rgba(255,255,255,0.32) 6px, rgba(255,255,255,0.32) 10px)",
          }}
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
      {bar.coverUrl && density.showCover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bar.coverUrl}
          alt=""
          className="w-4 h-4 rounded-sm object-cover shrink-0 mr-1 ring-1 ring-white/30 pointer-events-none"
          loading="lazy"
        />
      )}
      <span
        className={`truncate pointer-events-none px-0.5 font-medium${bar.hasChannelOverride ? " italic" : ""}`}
        // Title duplicates the indicator hint for hover tooltip — the
        // outer bar's title already shows the dates, so we only add this
        // when there's an override to flag.
        title={
          bar.hasChannelOverride
            ? t("override.indicator_title")
            : undefined
        }
      >
        {bar.hasChannelOverride && (
          <span aria-hidden className="mr-0.5 opacity-90">
            ✱
          </span>
        )}
        {bar.name}
      </span>
      {bar.videoUrl && !isCancelled && (
        // Play button — opens the country-specific spot URL in a new tab.
        // Stops pointer-down so it doesn't trigger bar drag; stops click so
        // it doesn't reach the bar's navigate-on-click. Anchor (not button)
        // so the browser handles target=_blank natively, including
        // middle-click → open in background tab.
        <a
          href={bar.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={bar.name}
          title={t("timeline.bar_play")}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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
      {!bar.videoUrl && !isCancelled && (
        // No spot assigned for this country yet. Render a small dashed
        // ring in the play-button slot so the user can see at a glance
        // which bars need a spot — it's a planned-not-yet-produced state,
        // not an error, so the marker is intentionally subtle.
        <span
          aria-hidden
          title={t("timeline.bar_no_spot")}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-dashed border-white/70 pointer-events-none"
        />
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
