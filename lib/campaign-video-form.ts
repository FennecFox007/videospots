// Helper for parsing the per-country video URL fields out of a campaign
// form submission. Each country renders an input named `videoUrl_<countryId>`;
// we walk the FormData and collect non-empty entries into a flat list ready
// for inserting into the campaign_video table.

export type VideoByCountry = { countryId: number; videoUrl: string };

export function extractVideosByCountry(formData: FormData): VideoByCountry[] {
  const out: VideoByCountry[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^videoUrl_(\d+)$/.exec(key);
    if (!m) continue;
    if (typeof value !== "string") continue;
    const url = value.trim();
    if (!url) continue;
    const countryId = Number(m[1]);
    if (!Number.isFinite(countryId) || countryId <= 0) continue;
    out.push({ countryId, videoUrl: url });
  }
  return out;
}
