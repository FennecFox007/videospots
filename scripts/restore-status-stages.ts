// One-shot fix-up for spots that were collapsed to 've_vyrobe' by the
// earlier narrowing migration but should logically be at
// 'ceka_na_schvaleni' (have a videoUrl, not yet approved by Sony).
// Now that the production_status enum is back to 5 stages, restore the
// "creative is sitting waiting for sign-off" signal.
//
// Conservative: only touches rows where ALL three conditions hold:
//   - production_status = 've_vyrobe'
//   - video_url is non-empty
//   - client_approved_at IS NULL
// Editors who deliberately moved spots back to 've_vyrobe' (e.g. while
// polishing) won't be touched as long as Sony hasn't approved — but
// because we don't have a "polishing-but-was-pending" history, those
// are indistinguishable. Run once, immediately after the spot-status
// expansion deploy.

import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";

async function main() {
  const before = await db.execute(sql`
    SELECT production_status, count(*)::int AS n
    FROM spot
    GROUP BY production_status
    ORDER BY production_status
  `);
  console.log("Before:");
  for (const row of before.rows ?? []) {
    console.log(`  ${row.production_status}: ${row.n}`);
  }

  const moved = await db.execute(sql`
    UPDATE spot
    SET production_status = 'ceka_na_schvaleni'
    WHERE production_status = 've_vyrobe'
      AND video_url IS NOT NULL
      AND length(trim(video_url)) > 0
      AND client_approved_at IS NULL
  `);
  console.log("\nve_vyrobe + URL + not approved → ceka_na_schvaleni:", moved.rowCount ?? "?");

  const after = await db.execute(sql`
    SELECT production_status, count(*)::int AS n
    FROM spot
    GROUP BY production_status
    ORDER BY production_status
  `);
  console.log("\nAfter:");
  for (const row of after.rows ?? []) {
    console.log(`  ${row.production_status}: ${row.n}`);
  }
}

main()
  .then(() => {
    console.log("\nRestore complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Restore failed:", err);
    process.exit(1);
  });
