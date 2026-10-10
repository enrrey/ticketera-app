import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { events, superAdminAssignments } from "../src/lib/db/schema";
import { getAccessUser } from "../src/modules/identity-access/services/identityStore";
import { manageEvent } from "../src/modules/events/services/eventManagement";
import { listDatabaseEvents } from "../src/modules/events/services/eventListing";
import type { EventInput } from "../src/modules/events/eventManagement.types";

config({ path: [".env.local", ".env"], quiet: true });
const name = "PRUEBA · Ticketera — sin validez comercial";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta configurar la base de datos");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const database = drizzle(pool);
    const result = await database.transaction(async (tx) => {
      const [assignment] = await tx.select().from(superAdminAssignments).where(eq(superAdminAssignments.key, "primary"));
      if (!assignment) throw new Error("Falta el super administrador designado");
      // Also serializes concurrent runs so this command cannot create duplicates.
      await tx.execute(sql`select id from "user" where id=${assignment.userId}::uuid for update`);
      const actor = await getAccessUser(assignment.userId, tx);
      if (!actor || actor.email !== "ronaldreyesramirez@gmail.com" || actor.status !== "active" || !actor.roles.includes("super_admin")) {
        throw new Error("La cuenta designada no es el super administrador activo esperado");
      }
      const [existing] = await tx.select().from(events).where(eq(events.name, name));
      if (existing) {
        if (existing.status !== "published" || !existing.featured) throw new Error("El evento de prueba ya existe; revisa su estado antes de modificarlo");
        return { id: existing.id, slug: existing.slug, status: existing.status, reused: true };
      }
      const now = new Date();
      const limaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const start = new Date(`${limaDay}T20:00:00-05:00`);
      start.setUTCDate(start.getUTCDate() + 7);
      const input: EventInput = {
        name, category: "conference", status: "draft", featured: false,
        description: "Evento ficticio para validar Ticketera. No corresponde a un espectáculo real. Sin validez comercial: no asistir ni realizar pagos. El precio y el aforo son datos de prueba.",
        imageUrl: "/images/event-placeholder.svg", venueName: "Recinto ficticio de prueba Ticketera",
        address: "Dirección ficticia de prueba — sin atención al público", city: "Lima", minimumAge: 0,
        entryInstructions: "PRUEBA: las entradas no tienen validez para asistir a eventos.",
        sessions: [{ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString() }],
        ticketTypes: [{ name: "General · PRUEBA", zone: "Zona ficticia de prueba", seatingType: "numbered",
          description: "Espacio ficticio sin validez comercial. Precio de prueba.", priceCents: 1000, capacity: 25,
          maxPerOrder: 6, peoplePerUnit: 1, seatRows: [{label:"A",seats:10},{label:"B",seats:10},{label:"C",seats:5}], sessionIndexes: [0],
          salesStartAt: now.toISOString(), salesEndAt: new Date(start.getTime() - 60 * 60 * 1000).toISOString() }],
      };
      const created = await manageEvent(actor.id, "POST", undefined, input, tx);
      if (!created || !("slug" in created)) throw new Error("No se pudo crear el evento de prueba");
      // Keep the ticket IDs produced during creation when publishing the draft.
      await manageEvent(actor.id, "PATCH", created.slug, { ...input, ticketTypes: undefined, status: "published", featured: true }, tx);
      return { ...created, status: "published", reused: false };
    });
    const visible = (await listDatabaseEvents("public", null, database)).find((event) => event.id === result.slug);
    if (!visible?.featured) throw new Error("El evento no aparece destacado en el catálogo público");
    const counts = await pool.query('select (select count(*) from "order") as orders, (select count(*) from ticket) as tickets, (select count(*) from payment) as payments, (select count(*) from event where status=\'draft\') as drafts');
    console.log(JSON.stringify({ ...result, url: `http://localhost:3000/eventos/${result.slug}`, featured: visible.featured, date: visible.date, price: visible.price, ticketOptions: visible.ticketOptions, counts: counts.rows[0] }, null, 2));
  } finally { await pool.end(); }
}

main().catch(() => { console.error("No se pudo publicar/verificar el evento de prueba; revisa la configuración y los permisos."); process.exitCode = 1; });
