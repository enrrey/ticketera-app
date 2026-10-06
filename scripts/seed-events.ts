import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import { users } from "../src/lib/db/schema";
import { seedMockEvents, validateOrganizerId } from "../src/modules/events/services/eventSeed";

export async function runEventSeed(args: string[]) {
  const organizerArgs = args.filter((arg) => arg.startsWith("--organizer="));
  const emailArgs = args.filter((arg) => arg.startsWith("--organizer-email="));
  if (args.length && !(args.length === 1 && organizerArgs.length === 1) && emailArgs.length !== args.length) throw new Error("Usage: npm run db:seed:events -- --organizer-email=<email> (repeat for multiple organizers), or --organizer=<uuid>");
  const organizerId = organizerArgs[0]?.slice("--organizer=".length);
  if (organizerId) validateOrganizerId(organizerId);
  const emails = [...new Set(emailArgs.length ? emailArgs.map((arg) => arg.slice("--organizer-email=".length).trim().toLowerCase()) : ["rreyes_ica@sunarp.gob.pe"])];
  config({ path: ".env.local", quiet: true });
  config({ quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const database = drizzle(pool);
    const accounts = organizerId ? [] : await database.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, emails));
    if (!organizerId && accounts.length !== emails.length) throw new Error("All organizer emails must belong to existing users");
    console.log(await seedMockEvents(database, organizerId ?? accounts.map((account) => account.id)));
  } finally {
    await pool.end();
  }
}

const isEntryPoint = typeof require !== "undefined"
  ? require.main === module
  : !!process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isEntryPoint) {
  runEventSeed(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Event seed failed");
    process.exitCode = 1;
  });
}
