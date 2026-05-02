// Read-only timeline used on /share/<token> for public viewers. Mirrors the
// visual layout of the interactive Timeline but is a plain server component:
// no drag, no menus, no client JS to ship to external visitors. Bars are
// static `<div>`s — non-clickable since /campaigns/[id] is auth-gated.

import {
  daysBetween,
  formatDate,
  formatDateShort,
  formatMonthName,
  pluralCs,
} from "@/lib/utils";
import {
  communicationTypeLabel,
  computeLifecyclePhase,
  lifecycleLabel,
} from "@/lib/communication";

export type PublicChannel = {
  id: number;
  chainName: string;
};

export type PublicCountryGroup = {
  id: number;
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
  productReleaseDate: Date | null;
  startsAt: Date;
  endsAt: Date;
  channelId: number;
};

type Props = {
  groups: PublicCountryGroup[];
  campaigns: PublicCampaign[];
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
};

const BAR_HEIGHT = 28;
const BAR_MIN_WIDTH_PX = 24;
const LANE_GAP = 4;
const ROW_PAD_TOP = 4;
const ROW_PAD_BOTTOM = 4;
const ONE_DAY_MS = 86_400_000;
const COMPACT_DAY_THRESHOLD = 45;

export function PublicTimeline({
  groups,
  campaigns,
  rangeStart,
  rangeEnd,
  now,
}: Props) {
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
        name: formatMonthName(cur),
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
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
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
                      const isCancelled = b.status === "cancelled";
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
                      const phase = computeLifecyclePhase(
                        b.startsAt,
                        b.endsAt,
                        b.productReleaseDate ?? null
                      );
                      const phaseLabel =
                        phase === "no-release" ? "" : lifecycleLabel(phase);
                      const commLabel = b.communicationType
                        ? communicationTypeLabel(b.communicationType)
                        : "";
                      const tooltipExtras = [commLabel, phaseLabel]
                        .filter(Boolean)
                        .join(" · ");
                      let releaseMarkerPct: number | null = null;
                      if (b.productReleaseDate) {
                        const r = b.productReleaseDate.getTime();
                        const s = b.startsAt.getTime();
                        const e = b.endsAt.getTime() + ONE_DAY_MS;
                        if (r >= s && r <= e && e > s) {
                          releaseMarkerPct = ((r - s) / (e - s)) * 100;
                        }
                      }
                      return (
                        <div
                          key={`${b.campaignId}-${b.channelId}`}
                          className="absolute text-white text-xs px-2 rounded flex items-center overflow-hidden z-[1]"
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
                          title={`${b.name}\n${formatDate(b.startsAt)} – ${formatDate(b.endsAt)} (${dur} ${pluralCs(dur, "den", "dny", "dní")})${tooltipExtras ? `\n${tooltipExtras}` : ""}${b.productReleaseDate ? `\nVydání: ${formatDate(b.productReleaseDate)}` : ""}`}
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
                          <span className="truncate font-medium">
                            {b.name}
                          </span>
                          {releaseMarkerPct !== null && (
                            <span
                              aria-hidden
                              className="absolute top-0 bottom-0 pointer-events-none flex items-center"
                              style={{
                                left: `${releaseMarkerPct}%`,
                                transform: "translateX(-50%)",
                              }}
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
