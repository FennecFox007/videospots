// Tiny wrapper around the country flag emoji. Emoji on its own reads
// "naked" next to Lucide stroke icons elsewhere in the chrome — putting
// it in a small rounded chip with a subtle ring gives it a framed,
// badge-like look that matches the rest of the icon vocabulary.
//
// Why not switch away from emoji entirely:
// - Real SVG flag images would need a new dep or hand-drawn assets for
//   CZ/SK/HU/PL (and any new country added in /admin/countries).
// - ISO code badges ("CZ" / "SK" / …) lose the visual cue at a glance,
//   especially in tight rows like the timeline group headers.
// - Emoji rendering is solid on macOS / Win11 / Linux with a flag font
//   — the actual partner targets — so the cross-platform downside is
//   small for now.
//
// The DB stores `country.flagEmoji` so a value can in principle be
// missing; we render a neutral globe-ish dot in that case so the layout
// doesn't jump.

type Size = "xs" | "sm" | "md";

const SIZE_BOX: Record<Size, string> = {
  xs: "w-4 h-4 text-[10px]", // dense rows: search results, compact pills
  sm: "w-5 h-5 text-xs", // standard: timeline header, /spots table
  md: "w-6 h-6 text-sm", // emphasis: detail page header
};

type Props = {
  /** ISO-2 code (CZ / SK / HU / PL …) — used only as a tooltip. */
  code: string;
  /** Emoji glyph from `country.flagEmoji`. May be null on legacy rows. */
  flag: string | null;
  size?: Size;
  className?: string;
};

export function CountryBadge({
  code,
  flag,
  size = "sm",
  className = "",
}: Props) {
  return (
    <span
      aria-hidden
      title={code}
      className={
        `inline-flex items-center justify-center shrink-0 rounded-md bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700 leading-none ${SIZE_BOX[size]} ${className}`
      }
    >
      {flag ?? "🌐"}
    </span>
  );
}
