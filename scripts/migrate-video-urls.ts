// One-shot migration: for each campaign with a non-null campaigns.videoUrl,
// copy that URL into campaign_video for every country the campaign has at
// least one channel in. After this runs the legacy column is no longer the
// source of truth.
//
// Run: npx tsx --env-file=.env.local scripts/migrate-video-urls.ts
//
// Idempotent: ON CONFLICT DO NOTHING keeps existing per-country edits intact
// if the script is run more than once.

import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

config({ path: ".env.local" });

async function main() {
  const result = await db.execute<{ inserted: number }>(sql`
    WITH ins AS (
      INSERT INTO campaign_video (campaign_id, country_id, video_url)
      SELECT DISTINCT
        c.id AS campaign_id,
        ch.country_id,
        c.video_url
      FROM campaign c
      JOIN campaign_channel cc ON cc.campaign_id = c.id
      JOIN channel ch ON ch.id = cc.channel_id
      WHERE c.video_url IS NOT NULL AND c.video_url <> ''
      ON CONFLICT (campaign_id, country_id) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted FROM ins
  `);
  const rows = (result.rows as Array<{ inserted: number }> | undefined) ?? [];
  const inserted = rows[0]?.inserted ?? 0;
  console.log(`Migrated: inserted ${inserted} rows into campaign_video`);
  console.log(
    "Note: campaigns.video_url column is kept as deprecated; new code reads/writes only via campaign_video."
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
