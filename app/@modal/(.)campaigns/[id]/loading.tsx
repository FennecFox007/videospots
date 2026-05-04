// Skeleton for the campaign peek panel. Next.js renders this instantly when
// the user clicks a bar (or any Link to /campaigns/<id> that gets intercepted
// into the @modal slot), then swaps it for the real content from page.tsx
// when the queries finish. Without this file the user stares at a frozen
// timeline for ~200–300 ms while Neon serves data.
//
// The skeleton intentionally mirrors the real panel's layout so the swap
// doesn't shift things around — same header, same sections, same gaps.

import { SidePanel } from "@/components/side-panel";

export default function CampaignPeekLoading() {
  return (
    <SidePanel
      title="…"
      subtitle={
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <span className="inline-block h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <span className="inline-block h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <SkeletonBlock lines={2} />
        <SkeletonBlock lines={3} withCover />
        <SkeletonBlock lines={2} />
        <SkeletonBlock lines={2} pillsRow />
      </div>
    </SidePanel>
  );
}

function SkeletonBlock({
  lines = 2,
  withCover = false,
  pillsRow = false,
}: {
  lines?: number;
  withCover?: boolean;
  pillsRow?: boolean;
}) {
  return (
    <div>
      <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 mb-2 animate-pulse" />
      {withCover ? (
        <div className="flex items-start gap-3">
          <div className="w-12 h-16 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            {Array.from({ length: lines }).map((_, i) => (
              <div
                key={i}
                className="h-3 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                style={{ width: `${85 - i * 15}%` }}
              />
            ))}
          </div>
        </div>
      ) : pillsRow ? (
        <div className="flex flex-wrap gap-1.5">
          {[60, 80, 70, 90, 50].map((w, i) => (
            <span
              key={i}
              className="h-5 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse"
              style={{ width: `${90 - i * 20}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
