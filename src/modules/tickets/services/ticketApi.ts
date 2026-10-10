import { getCurrentAccessUser } from '@/modules/identity-access';
import { readTickets } from './readTickets';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, x-order-token'};
export async function handleOrderTickets(request:Request,orderId:string) {
  const value=new URL(request.url).searchParams.get('page')??'1';
  if (!/^[1-9][0-9]{0,5}$/.test(value)) return Response.json({error:'Página inválida'},{status:400,headers});
  try {
    const member=await getCurrentAccessUser();
    if (member&&member.status!=='active') return Response.json({error:'Cuenta inactiva'},{status:403,headers});
    const data=await readTickets(orderId,{userId:member?.id??null,token:request.headers.get('x-order-token')},Number(value));
    return data?Response.json(data,{headers}):Response.json({error:'Pedido no encontrado'},{status:404,headers});
  } catch {return Response.json({error:'No pudimos cargar tus entradas. Inténtalo de nuevo.'},{status:503,headers});}
}
