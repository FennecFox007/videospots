// One-shot backfill for spots.production_status. Drizzle's `npm run db:push`
// adds the column with default 'bez_zadani' for all existing rows; this
// script overrides that default for rows that should be in a downstream
// state based on existing fields:
//   clientApprovedAt IS NOT NULL          → 'schvalen'
//   videoUrl set AND not yet approved     → 'ceka_na_schvaleni'
//   else (videoUrl empty + not approved)  → 'bez_zadani' (left as default)
//
// Idempotent: re-running it overwrites only rows that match the predicate,
// so editor-set states (zadan / ve_vyrobe) won't be reverted on re-run as
// long as those rows have videoUrl set (they'll match the second clause).
//
// Run once after `npm run db:push`. After the rollout is verified, this
// file can be deleted (kept here in scripts/ as a record).

import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";

async function main() {
  // Phase 1: approved spots → 'schvalen'
  const approved = await db.execute(sql`
    UPDATE spot
    SET production_status = 'schvalen'
    WHERE client_approved_at IS NOT NULL
      AND production_status = 'bez_zadani'
  `);
  console.log("Approved → schvalen:", approved.rowCount ?? "?");

  // Phase 2: spots with a videoUrl but no approval → 'ceka_na_schvaleni'
  const awaiting = await db.execute(sql`
    UPDATE spot
    SET production_status = 'ceka_na_schvaleni'
    WHERE client_approved_at IS NULL
      AND video_url IS NOT NULL
      AND length(trim(video_url)) > 0
      AND production_status = 'bez_zadani'
  `);
  console.log("Has URL, not approved → ceka_na_schvaleni:", awaiting.rowCount ?? "?");

  // Verify final distribution
  const distribution = await db.execute(sql`
    SELECT production_status, count(*)::int AS n
    FROM spot
    GROUP BY production_status
    ORDER BY n DESC
  `);
  console.log("\nFinal distribution:");
  for (const row of distribution.rows ?? []) {
    console.log(`  ${row.production_status}: ${row.n}`);
  }
}

main()
  .then(() => {
    console.log("\nBackfill complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
