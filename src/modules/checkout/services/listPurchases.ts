import { eq, sql } from 'drizzle-orm';
import type { PgDatabase,PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDatabase } from '@/lib/db';
import { orders } from '@/lib/db/schema';
export async function listPurchases(userId:string,page=1,database:PgDatabase<PgQueryResultHKT,Record<string,unknown>>=getDatabase()) {
  const pageSize=12;
  const [count]=await database.select({n:sql<number>`count(*)::int`}).from(orders).where(eq(orders.userId,userId));
  const rows=await database.select({id:orders.id,status:orders.status,totalCents:orders.totalCents,currency:orders.currency,createdAt:orders.createdAt,
    units:sql<number>`(select sum(quantity)::int from order_item where order_id="order"."id")`,
    eventNames:sql<string>`(select string_agg(distinct e.name, ', ') from order_item oi join ticket_type tt on tt.id=oi.ticket_type_id join event e on e.id=tt.event_id where oi.order_id="order"."id")`
  }).from(orders).where(eq(orders.userId,userId)).orderBy(sql`${orders.createdAt} desc`,orders.id).limit(pageSize).offset((page-1)*pageSize);
  return {orders:rows,total:Number(count.n),page,pageSize};
}
