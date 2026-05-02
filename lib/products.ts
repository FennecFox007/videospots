// Product (=campaign subject) types. Most campaigns promote a game, but
// hardware launches (consoles, controllers, accessories) and services
// (PS Plus subscriptions, premieres) need to live in the same table.

export const PRODUCT_KINDS = [
  { value: "game", label: "Hra", emoji: "🎮" },
  { value: "console", label: "Konzole", emoji: "🖥️" },
  { value: "controller", label: "Ovladač", emoji: "🕹️" },
  { value: "accessory", label: "Příslušenství", emoji: "🎧" },
  { value: "service", label: "Služba", emoji: "🛒" },
  { value: "other", label: "Jiné", emoji: "📦" },
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number]["value"];

export const DEFAULT_PRODUCT_KIND: ProductKind = "game";

export function isValidKind(s: string): s is ProductKind {
  return PRODUCT_KINDS.some((k) => k.value === s);
}

export function kindLabel(s: string): string {
  return PRODUCT_KINDS.find((k) => k.value === s)?.label ?? s;
}

export function kindEmoji(s: string): string {
  return PRODUCT_KINDS.find((k) => k.value === s)?.emoji ?? "📦";
}
