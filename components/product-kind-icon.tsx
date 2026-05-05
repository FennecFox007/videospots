// Lucide icon for a product kind, rendered at a uniform size. Replaces
// the emoji glyphs returned by `kindEmoji()` in chrome surfaces (peek
// panel, /campaigns table, /spots table) so they sit visually next to
// the rest of the Lucide stroke vocabulary instead of feeling like
// stray emoji.
//
// `lib/products.ts` still owns the kind list + labels; this is purely
// presentational. The form pickers (campaign-form-body / spot-form-body)
// keep using the kindLabel + emoji pairing in <option> text because
// <select> options can't render React nodes — fine, not chrome.

import {
  Gamepad2,
  Monitor,
  Joystick,
  Headphones,
  ShoppingBag,
  Package,
  type LucideIcon,
} from "lucide-react";

const ICON_BY_KIND: Record<string, LucideIcon> = {
  game: Gamepad2,
  console: Monitor,
  controller: Joystick,
  accessory: Headphones,
  service: ShoppingBag,
  other: Package,
};

type Props = {
  kind: string;
  className?: string;
};

export function ProductKindIcon({ kind, className = "w-4 h-4" }: Props) {
  const Icon = ICON_BY_KIND[kind] ?? Package;
  return <Icon className={className} strokeWidth={2} />;
}
