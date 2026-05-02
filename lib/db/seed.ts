// Run with: npm run db:seed
//
// Authoritative for countries / chains / channels: re-running this script
// reconciles the DB state to match the constants below. Adds what's missing,
// removes what's not in the desired set.
//
// Surgical for channels: only inserts/deletes channels that differ from the
// desired matrix, so campaign_channel rows for unchanged (country × chain)
// pairs survive a re-seed.
//
// Idempotent for the admin user: created once, not touched after.
//
// Env is loaded via `tsx --env-file=.env.local` (see package.json).

import bcrypt from "bcryptjs";
import { eq, inArray, notInArray } from "drizzle-orm";
import {
  db,
  countries,
  chains,
  channels,
  users,
  campaigns,
} from "./client";

const DESIRED_COUNTRIES = [
  { code: "CZ", name: "Česko", flagEmoji: "🇨🇿", sortOrder: 1 },
  { code: "SK", name: "Slovensko", flagEmoji: "🇸🇰", sortOrder: 2 },
  { code: "HU", name: "Maďarsko", flagEmoji: "🇭🇺", sortOrder: 3 },
  { code: "PL", name: "Polsko", flagEmoji: "🇵🇱", sortOrder: 4 },
];

const DESIRED_CHAINS = [
  { code: "alza", name: "Alza", sortOrder: 1 },
  { code: "datart", name: "Datart", sortOrder: 2 },
  { code: "planeo", name: "Planeo", sortOrder: 3 },
  { code: "nay", name: "Nay", sortOrder: 4 },
  { code: "pgs", name: "PGS", sortOrder: 5 },
  { code: "mediamarkt", name: "MediaMarkt", sortOrder: 6 },
];

// Authoritative country × chain matrix.
const DESIRED_MATRIX: Array<[countryCode: string, chainCode: string]> = [
  ["CZ", "alza"],
  ["CZ", "datart"],
  ["CZ", "planeo"],
  ["SK", "alza"],
  ["SK", "nay"],
  ["SK", "pgs"],
  ["HU", "alza"],
  ["PL", "mediamarkt"],
];

async function main() {
  console.log("→ Seeding countries...");
  await db.insert(countries).values(DESIRED_COUNTRIES).onConflictDoNothing();

  console.log("→ Reconciling chains...");
  // Add any missing desired chains.
  await db.insert(chains).values(DESIRED_CHAINS).onConflictDoNothing();
  // Drop chains not in the desired list. Cascades to their channels and any
  // campaign_channel rows that referenced them.
  const desiredChainCodes = DESIRED_CHAINS.map((c) => c.code);
  await db.delete(chains).where(notInArray(chains.code, desiredChainCodes));

  console.log("→ Reconciling channel matrix...");
  const desiredSet = new Set(
    DESIRED_MATRIX.map(([c, ch]) => `${c}:${ch}`)
  );
  const current = await db
    .select({
      channelId: channels.id,
      countryCode: countries.code,
      chainCode: chains.code,
    })
    .from(channels)
    .innerJoin(countries, eq(channels.countryId, countries.id))
    .innerJoin(chains, eq(channels.chainId, chains.id));

  const toDelete: number[] = [];
  const currentSet = new Set<string>();
  for (const c of current) {
    const key = `${c.countryCode}:${c.chainCode}`;
    if (desiredSet.has(key)) {
      currentSet.add(key);
    } else {
      toDelete.push(c.channelId);
    }
  }
  if (toDelete.length > 0) {
    await db.delete(channels).where(inArray(channels.id, toDelete));
    console.log(`   - removed ${toDelete.length} channels`);
  }

  const allCountries = await db.select().from(countries);
  const allChains = await db.select().from(chains);
  const cByCode = new Map(allCountries.map((c) => [c.code, c.id]));
  const chByCode = new Map(allChains.map((c) => [c.code, c.id]));

  const toInsert: { countryId: number; chainId: number }[] = [];
  for (const [cc, chc] of DESIRED_MATRIX) {
    if (currentSet.has(`${cc}:${chc}`)) continue;
    const countryId = cByCode.get(cc);
    const chainId = chByCode.get(chc);
    if (countryId == null || chainId == null) continue;
    toInsert.push({ countryId, chainId });
  }
  if (toInsert.length > 0) {
    await db.insert(channels).values(toInsert);
    console.log(`   + added ${toInsert.length} channels`);
  }

  console.log("→ Ensuring admin user exists (admin / admin)...");
  await db
    .insert(users)
    .values({
      email: "admin",
      name: "Admin",
      passwordHash: bcrypt.hashSync("admin", 10),
    })
    .onConflictDoNothing();

  // Approval workflow was removed — promote any leftover drafts.
  console.log("→ Promoting any leftover draft campaigns to approved...");
  await db
    .update(campaigns)
    .set({ status: "approved" })
    .where(eq(campaigns.status, "draft"));

  const finalChannels = await db.select().from(channels);
  console.log(
    `✔ Seed complete: ${allCountries.length} countries, ${allChains.length} chains, ${finalChannels.length} channels.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
