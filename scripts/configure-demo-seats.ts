import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { events,superAdminAssignments } from '../src/lib/db/schema';
import { manageEvent } from '../src/modules/events/services/eventManagement';
import type { EventInput,ManagedEvent } from '../src/modules/events/eventManagement.types';
config({path:['.env.local','.env'],quiet:true});
async function run() {
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  try {
    const database=drizzle(pool);
    const [actor]=await database.select().from(superAdminAssignments).where(eq(superAdminAssignments.key,'primary'));
    const [event]=await database.select().from(events).where(eq(events.name,'PRUEBA · Ticketera — sin validez comercial'));
    if(!actor||!event) throw new Error('Missing identified demo');
    const detail=await manageEvent(actor.userId,'GET',event.slug,undefined,database) as ManagedEvent;
    if(detail.hasOrders) throw new Error('Preserve purchased conditions');
    const input:EventInput={name:detail.name,category:detail.category,description:detail.description,imageUrl:detail.imageUrl,
      venueName:detail.venueName,address:detail.address,city:detail.city,sessions:detail.sessions,status:detail.status,
      featured:detail.featured,minimumAge:detail.minimumAge,entryInstructions:detail.entryInstructions,
      seatingLayout:{enabled:true,template:'stadium',stagePosition:'north'},
      ticketTypes:([['Tribuna Occidente','west'],['Tribuna Oriente','east'],['Tribuna Sur','south']] as const).map(([name,mapPosition],index)=>{
        const base=detail.ticketTypes?.[0];
        if(!base) throw new Error('Missing demo type');
        return {...base,id:index===0?base.id:undefined,name,zone:name,mapPosition,seatingType:'numbered' as const,
          seatRows:[{label:'A',seats:10},{label:'B',seats:10},{label:'C',seats:5}],capacity:25,maxPerOrder:6};
      })};
    await manageEvent(actor.userId,'PATCH',detail.slug,input,database);
    console.log(JSON.stringify({event:detail.slug,seating:'numbered',tribunes:3,seatsPerTribune:25,maxPerOrder:6}));
  } finally {await pool.end();}
}
run().catch(()=>{console.error('No se modificó el evento de prueba: no existe, tiene pedidos o falta permiso.');process.exitCode=1;});
