import { config } from 'dotenv';
import pg from 'pg';
config({ path: ['.env.local', '.env'], quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const result = await client.query(`select o.status, e.name as event, tt.seating_type, sum(oi.quantity)::int as units,
    (select count(*)::int from ticket t join order_item ti on ti.id=t.order_item_id where ti.order_id=o.id) as tickets
    from "order" o join order_item oi on oi.order_id=o.id join ticket_type tt on tt.id=oi.ticket_type_id join event e on e.id=tt.event_id
    group by o.id,e.name,tt.seating_type order by o.created_at desc limit 20`);
  console.log(JSON.stringify(result.rows));
} catch (error) { console.error('Purchase inspection failed', error.code || 'connection'); process.exitCode=1; }
finally { await client.end(); }
