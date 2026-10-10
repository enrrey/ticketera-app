import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { AccessError, getAccessUser, getCurrentAccessUser } from "@/modules/identity-access";
import type { AccessUser } from "@/modules/identity-access";
import type { DashboardMetrics } from "../types";

export function assertReportingAccess(actor: AccessUser | null): AccessUser {
  if (!actor) throw new AccessError(401, "Debes iniciar sesión");
  if (actor.status !== "active" || !actor.permissions.includes("events.manage") || !actor.roles.some(role => ["admin", "super_admin", "organizer"].includes(role))) {
    throw new AccessError(403, "No tienes permiso para consultar métricas");
  }
  return actor;
}

export async function getDashboardMetrics(actorId: string, database: PgDatabase<PgQueryResultHKT, Record<string, unknown>> = getDatabase()): Promise<DashboardMetrics> {
  return database.transaction(async tx => {
    const actor = assertReportingAccess(await getAccessUser(actorId, tx));
    const global = actor.roles.some(role => role === "admin" || role === "super_admin");
    // Each aggregate has its own grain. Joining tickets, payments and refunds together
    // would multiply money by the number of tickets and refund attempts.
    const result = await tx.execute(sql`
      with scoped_events as (
        select id, status from event where ${global} or organizer_id=${actor.id}::uuid
      ), scoped_items as (
        select oi.*, o.status as order_status from order_item oi
        join ticket_type tt on tt.id=oi.ticket_type_id
        join scoped_events e on e.id=tt.event_id join "order" o on o.id=oi.order_id
      ), scoped_payments as (
        select p.* from payment p where exists (select 1 from scoped_items i where i.order_id=p.order_id)
        -- Checkout accepts one event per order. For legacy mixed orders, only count
        -- payments whose entire order belongs to the authorized scope.
        and not exists (select 1 from order_item oi join ticket_type tt on tt.id=oi.ticket_type_id
          where oi.order_id=p.order_id and not exists (select 1 from scoped_events e where e.id=tt.event_id))
      )
      select
        (select count(*) from ticket t join scoped_items i on i.id=t.order_item_id where t.status in ('valid','used') and i.order_status in ('paid','partially_refunded')) as sold,
        (select coalesce(sum(i.quantity::bigint*i.unit_price_cents),0) from scoped_items i where i.order_status in ('paid','partially_refunded','refunded')) as gross,
        (select coalesce(sum(amount_cents),0) from scoped_payments where status in ('succeeded','partially_refunded','refunded')) as captured,
        (select coalesce(sum(r.amount_cents),0) from refund r join scoped_payments p on p.id=r.payment_id where r.status='succeeded') as refunded,
        (select count(*) from check_in c join scoped_events e on e.id=c.event_id) as checkins,
        (select count(*) from scoped_events where status='draft') as draft,
        (select count(*) from scoped_events where status='published') as published,
        (select count(*) from scoped_events where status='cancelled') as cancelled,
        (select count(*) from scoped_events where status='completed') as completed
    `);
    const row = (result as { rows: Record<string, unknown>[] }).rows[0];
    const metrics: DashboardMetrics = {
      scope: global ? "global" : "organizer", soldTickets: Number(row.sold), grossSalesCents: Number(row.gross),
      capturedCents: Number(row.captured), confirmedRefundCents: Number(row.refunded),
      netCapturedCents: Number(row.captured) - Number(row.refunded), checkIns: Number(row.checkins),
      events: { draft: Number(row.draft), published: Number(row.published), cancelled: Number(row.cancelled), completed: Number(row.completed) },
    };
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "reporting.dashboard_read", entity: "reporting", entityId: actor.id, metadata: { scope: metrics.scope } });
    return metrics;
  });
}

export async function handleDashboardMetrics(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    if (request.method !== "GET") throw new AccessError(405, "Método no permitido");
    if (new URL(request.url).search) throw new AccessError(400, "Consulta inválida");
    const actor = assertReportingAccess(await getCurrentAccessUser());
    return Response.json(await getDashboardMetrics(actor.id), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof AccessError ? error.message : "No pudimos cargar las métricas" }, { status: error instanceof AccessError ? error.status : 503, headers });
  }
}
