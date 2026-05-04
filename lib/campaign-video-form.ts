// Helper for parsing the per-country spot picks out of a campaign form
// submission. Each country renders a <select name="spotId_<countryId>">;
// we walk the FormData and collect the selected (countryId, spotId) pairs.
// Empty values mean the user explicitly picked "— no spot —" for that
// country.

export type SpotByCountry = { countryId: number; spotId: number };

export function extractSpotsByCountry(formData: FormData): SpotByCountry[] {
  const out: SpotByCountry[] = [];
  for (const [key, value] of formData.entries()) {
    const m = /^spotId_(\d+)$/.exec(key);
    if (!m) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue; // user picked "— no spot —"
    const countryId = Number(m[1]);
    const spotId = Number(trimmed);
    if (!Number.isFinite(countryId) || countryId <= 0) continue;
    if (!Number.isFinite(spotId) || spotId <= 0) continue;
    out.push({ countryId, spotId });
  }
  return out;
}
