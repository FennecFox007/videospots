// One-shot backfill for the production-status narrowing (5 states → 3
// states). Legacy values 'ceka_na_schvaleni' and 'schvalen' collapse to
// 've_vyrobe' on the production axis; the approval signal is preserved
// independently via spots.client_approved_at, which the UI now reads as
// the dedicated approval axis.
//
// Run once: `dotenv -e .env.local -- tsx scripts/narrow-production-status.ts`

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

  // Collapse legacy 'ceka_na_schvaleni' and 'schvalen' → 've_vyrobe'.
  // Approval signal lives in client_approved_at — already preserved.
  const collapsed = await db.execute(sql`
    UPDATE spot
    SET production_status = 've_vyrobe'
    WHERE production_status IN ('ceka_na_schvaleni', 'schvalen')
  `);
  console.log("\nLegacy → ve_vyrobe:", collapsed.rowCount ?? "?");

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
    console.log("\nNarrow complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Narrow failed:", err);
    process.exit(1);
  });
