import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../src/lib/db';
import { orders, orderItems, tickets } from '../src/lib/db/schema';
import { issueTickets } from '../src/modules/tickets/server';
config({ path: ['.env.local','.env'], quiet: true });
async function run() {
  const database=getDatabase();
  const paid=await database.select({id:orders.id}).from(orders).where(eq(orders.status,'paid'));
  for (const order of paid) await database.transaction(tx=>issueTickets(tx,order.id));
  const emitted=await database.select({id:tickets.id}).from(tickets).innerJoin(orderItems,eq(orderItems.id,tickets.orderItemId)).innerJoin(orders,eq(orders.id,orderItems.orderId)).where(eq(orders.status,'paid'));
  console.log(JSON.stringify({paidOrders:paid.length,issuedTickets:emitted.length}));
}
run().then(()=>process.exit(0)).catch(()=>{console.error('No se pudo recuperar las entradas; no se modificaron los cobros.');process.exit(1);});
