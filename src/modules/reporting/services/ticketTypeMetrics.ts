import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { availableUnitsSql } from "@/modules/checkout/server";
import { AccessError, getAccessUser } from "@/modules/identity-access";
import type { TicketTypeMetricsPage } from "../types";
import { assertReportingAccess } from "./dashboardMetrics";

export async function getTicketTypeMetrics(actorId: string, page: number, database: PgDatabase<PgQueryResultHKT, Record<string, unknown>> = getDatabase()): Promise<TicketTypeMetricsPage> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) throw new AccessError(400, "Página inválida");
  return database.transaction(async tx => {
    const actor = assertReportingAccess(await getAccessUser(actorId, tx));
    const global = actor.roles.some(role => role === "admin" || role === "super_admin");
    // Limit types before aggregating; independent grains prevent tickets, payments
    // and refunds from multiplying immutable line-item amounts.
    const result = await tx.execute(sql`
      with page_types as materialized (
        select tt.id, tt.name, tt.capacity, e.id as event_id, e.name as event_name
        from ticket_type tt join event e on e.id=tt.event_id
        where ${global} or e.organizer_id=${actor.id}::uuid
        order by e.name, e.id, tt.name, tt.id limit 51 offset ${(page - 1) * 50}
      )
      select tt.id, tt.name, tt.event_id, tt.event_name, tt.capacity,
        ${availableUnitsSql(sql`tt.id`, sql`tt.capacity`)} as available,
        (select count(*) from ticket t join order_item oi on oi.id=t.order_item_id
          join "order" o on o.id=oi.order_id where oi.ticket_type_id=tt.id
          and t.status in ('valid','used') and o.status in ('paid','partially_refunded')) as sold,
        (select coalesce(sum(oi.total_cents::bigint),0) from order_item oi join "order" o on o.id=oi.order_id
          where oi.ticket_type_id=tt.id and o.status in ('paid','partially_refunded','refunded')) as paid_sales,
        (select count(*) from check_in c join ticket t on t.id=c.ticket_id
          join order_item oi on oi.id=t.order_item_id where oi.ticket_type_id=tt.id and c.event_id=tt.event_id) as checkins
      from page_types tt order by tt.event_name, tt.event_id, tt.name, tt.id
    `);
    const rows = (result as { rows: Record<string, unknown>[] }).rows;
    const response: TicketTypeMetricsPage = {
      scope: global ? "global" : "organizer", page, pageSize: 50, hasNextPage: rows.length > 50,
      items: rows.slice(0, 50).map(row => {
        const capacity = Number(row.capacity), availableUnits = Number(row.available);
        const committedUnits = capacity - availableUnits;
        return { eventId: String(row.event_id), eventName: String(row.event_name), ticketTypeId: String(row.id), ticketTypeName: String(row.name),
          soldTickets: Number(row.sold), paidSalesCents: Number(row.paid_sales), capacity, committedUnits, availableUnits,
          committedPercentage: Math.round(committedUnits / capacity * 10_000) / 100, checkIns: Number(row.checkins) };
      }),
    };
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "reporting.ticket_types_read", entity: "reporting", entityId: actor.id, metadata: { scope: response.scope, page } });
    return response;
  });
}
