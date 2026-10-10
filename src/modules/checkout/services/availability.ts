import { sql, type SQL } from "drizzle-orm";

/**
 * Units still sellable for a ticket type: capacity minus converted reservations
 * and active reservations that have not expired. Single source of truth shared by
 * the reservation transaction and the public listing.
 */
export function availableUnitsSql(ticketTypeId: SQL, capacity: SQL): SQL<number> {
  return sql<number>`greatest(0, ${capacity} - coalesce((
    select sum(greatest(0,r.quantity - case when r.status='converted' then (select count(*)::int from ticket t where t.order_item_id=oi.id and t.status='refunded') else 0 end))::int from inventory_reservation r join order_item oi on oi.id = r.order_item_id
    where oi.ticket_type_id = ${ticketTypeId} and (r.status = 'converted' or (r.status = 'active' and (
      r.expires_at > now() or exists(select 1 from payment p join "order" o on o.id=p.order_id where p.order_id=oi.order_id and (o.status='pending' or exists(select 1 from refund rf where rf.payment_id=p.id and rf.reason='event_cancelled_before_payment' and rf.status<>'succeeded')))
    )))
  ), 0))::int`;
}
