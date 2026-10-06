import { config } from "dotenv";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  const tables = await client.query("select tablename from pg_tables where schemaname = 'public' order by tablename");
  console.log(JSON.stringify(tables.rows));
  const counts = await client.query(`select
    (select count(*)::int from pg_tables where schemaname='public') as tables,
    (select count(*)::int from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and c.contype='f') as foreign_keys,
    (select count(*)::int from pg_indexes where schemaname='public') as indexes`);
  console.log(JSON.stringify(counts.rows[0]));
} catch (error) {
  console.error("Database inspection failed:", error.code || "connection error");
  process.exitCode = 1;
} finally {
  await client.end();
}
