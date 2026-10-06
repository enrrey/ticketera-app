import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let database: ReturnType<typeof drizzle> | undefined;

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  database ??= drizzle(new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10_000 }));
  return database;
}
