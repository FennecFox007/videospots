import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string."
  );
}

// Neon's HTTP driver works on Vercel Edge runtime and is the simplest setup.
// If we later need transactions or LISTEN/NOTIFY, swap to drizzle-orm/neon-serverless
// with a WebSocket Pool.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export type Db = typeof db;

// Re-export the schema so callers can do `import { db, campaigns } from "@/lib/db/client"`.
export * from "./schema";
