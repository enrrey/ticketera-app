import { sql, type SQL } from "drizzle-orm";

/**
 * Units still sellable for a ticket type: capacity minus converted reservations
 * and active reservations that have not expired. Single source of truth shared by
 * the reservation transaction and the public listing.
 */
export function availableUnitsSql(ticketTypeId: SQL, capacity: SQL): SQL<number> {
  return sql<number>`greatest(0, ${capacity} - coalesce((
    select sum(r.quantity)::int from inventory_reservation r join order_item oi on oi.id = r.order_item_id
    where oi.ticket_type_id = ${ticketTypeId} and (r.status = 'converted' or (r.status = 'active' and r.expires_at > now()))
  ), 0))::int`;
}
