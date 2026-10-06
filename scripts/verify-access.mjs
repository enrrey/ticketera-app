import assert from "node:assert/strict";
import { config } from "dotenv";
import pg from "pg";

config({ path: [".env.local", ".env"], quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  const access = await client.query(`select u.email, u.status, r.name as role from "user" u join user_role ur on ur.user_id=u.id join "role" r on r.id=ur.role_id join super_admin_assignment a on a.user_id=u.id where a.key='primary'`);
  assert(access.rows.some((r) => r.email === "ronaldreyesramirez@gmail.com" && r.role === "super_admin" && r.status === "active"));
  const counts = await client.query(`select (select count(*)::int from event) as events, (select count(*)::int from event_session) as sessions, (select count(*)::int from ticket_type) as inventory`);
  assert.deepEqual(counts.rows[0], { events: 0, sessions: 0, inventory: 0 }, "Event seed must remain unexecuted");
  for (const [path, method] of [["/api/me", "GET"], ["/api/admin/users", "GET"], ["/api/admin/users", "POST"], ...["GET", "PATCH", "DELETE"].map((method) => ["/api/admin/users/00000000-0000-0000-0000-000000000001", method])]) {
    const response = await fetch(`http://localhost:3000${path}`, { method, signal: AbortSignal.timeout(60_000) });
    assert.equal(response.status, 401, `${method} ${path} must require authentication`);
  }
  const page = await fetch("http://localhost:3000/administracion/usuarios", { redirect: "manual", signal: AbortSignal.timeout(60_000) });
  assert([307, 303].includes(page.status), "Management page must redirect unauthenticated visitors");
  assert(page.headers.get("location")?.includes("/ingresar"));
  console.log("Designated super admin, unauthorized HTTP access and unexecuted event seed: verified.");
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : "Access verification failed");
  process.exitCode = 1;
} finally { await client.end(); }
