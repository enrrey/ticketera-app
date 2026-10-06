import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { designatedSuperAdminEmail, synchronizeIdentity } from "../src/modules/identity-access/services/identityStore";
import { profileFromClerk } from "../src/modules/identity-access/services/clerkProfile";

config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.DATABASE_URL) throw new Error("Clerk and database configuration is required");
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data } = await clerk.users.getUserList({ emailAddress: [designatedSuperAdminEmail], limit: 10 });
  const verified = data.filter((user) => user.emailAddresses.some((email) => email.emailAddress.toLowerCase() === designatedSuperAdminEmail && email.verification?.status === "verified"));
  if (verified.length !== 1) throw new Error("The designated account must exist in Clerk and have exactly one verified match");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000, max: 1 });
  try {
    const access = await synchronizeIdentity(profileFromClerk(verified[0]), drizzle(pool));
    if (!access.roles.includes("super_admin")) throw new Error("Bootstrap is pinned to another identity; explicit reassignment is required");
    console.log(JSON.stringify({ email: access.email, roles: access.roles, status: access.status, permissions: access.permissions }));
  } finally { await pool.end(); }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error && !('clerkError' in error) ? error.message : "Bootstrap failed");
  process.exitCode = 1;
});
