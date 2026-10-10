// Local demo only. Never creates a purchase or prints private hold tokens.
const origin='http://localhost:3000';
const url=`${origin}/api/checkout/seats/prueba-ticketera-sin-validez-comercial-ac5fbd32`;
const active=[];
async function select(items,token){
  return fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{'x-seat-hold-token':token}:{})},body:JSON.stringify({items})});
}
try{
  const availability=await (await fetch(url)).json();
  const section=availability.availability?.[0];
  const number=Array.from({length:10},(_,i)=>i+1).find(n=>!section?.occupied.some(seat=>seat.rowLabel==='A'&&seat.seatNumber===n));
  if(!section||!number) throw new Error('No free demo seat');
  const items=[{ticketTypeId:section.ticketTypeId,seats:[{rowLabel:'A',seatNumber:number}]}];
  const first=await select(items);
  if(!first.ok) throw new Error('First hold failed');
  const firstBody=await first.json();active.push(firstBody.holdToken);
  const second=await select(items);
  if(second.status!==409) throw new Error('Concurrent buyer not rejected');
  const publicView=await (await fetch(url)).json();
  if(!publicView.availability.find(type=>type.ticketTypeId===section.ticketTypeId).occupied.some(seat=>seat.rowLabel==='A'&&seat.seatNumber===number))throw new Error('Public seat not occupied');
  const release=await fetch(url,{method:'DELETE',headers:{Origin:origin,'x-seat-hold-token':firstBody.holdToken}});
  if(release.status!==204) throw new Error('Release failed');
  const next=await select(items);
  if(!next.ok) throw new Error('Seat not available after release');
  active.push((await next.json()).holdToken);
  console.log(JSON.stringify({firstBuyer:'held',secondBuyer:'rejected409',publicAvailability:'occupied',afterRelease:'available',leaseSeconds:(Date.parse(firstBody.expiresAt)-Date.parse(firstBody.serverTime))/1000}));
}catch{console.error('Falló la verificación local de bloqueos.');process.exitCode=1;}
finally{for(const token of active)await fetch(url,{method:'DELETE',headers:{Origin:origin,'x-seat-hold-token':token}}).catch(()=>{});}
