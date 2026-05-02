// Fixed palette for campaign bars. All colors are tuned for readability with
// white text on top (Tailwind 500-level shades) and look distinct enough at
// thumbnail size in the timeline.

export type CampaignColor = {
  value: string; // hex
  name: string; // Czech label
};

export const CAMPAIGN_COLORS: CampaignColor[] = [
  { value: "#3b82f6", name: "Modrá" },
  { value: "#ef4444", name: "Červená" },
  { value: "#f59e0b", name: "Oranžová" },
  { value: "#10b981", name: "Zelená" },
  { value: "#8b5cf6", name: "Fialová" },
  { value: "#ec4899", name: "Růžová" },
  { value: "#06b6d4", name: "Tyrkysová" },
  { value: "#64748b", name: "Šedá" },
];

export const DEFAULT_CAMPAIGN_COLOR = CAMPAIGN_COLORS[0].value;

export function isValidCampaignColor(value: string): boolean {
  return CAMPAIGN_COLORS.some((c) => c.value === value);
}
