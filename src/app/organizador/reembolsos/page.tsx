import Link from 'next/link';
import {desc,eq,sql} from 'drizzle-orm';
import {getDatabase} from '@/lib/db';
import {payments,refunds} from '@/lib/db/schema';
import {AccessError,getAccessUser,requirePagePermission} from '@/modules/identity-access';
import {ManagementShell} from '@/modules/identity-access/client';
export const dynamic='force-dynamic';
const labels:Record<string,string>={pending:'En proceso',requires_action:'Requiere revisión',succeeded:'Completado',failed:'Fallido',cancelled:'Cancelado'};
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){
  const identity=await requirePagePermission('refunds.manage','/organizador/reembolsos');
  const db=getDatabase();const actor=await getAccessUser(identity.id,db);
  if(actor.status!=='active'||!actor.permissions.includes('refunds.manage')||!actor.roles.some(role=>['admin','super_admin','organizer'].includes(role)))throw new AccessError(403,'No tienes permiso para consultar reembolsos');
  const raw=(await searchParams).page;const page=raw&&/^\d{1,5}$/.test(raw)?Math.max(1,Number(raw)):1;
  const global=actor.roles.some(role=>['admin','super_admin'].includes(role));
  const rows=await db.select({id:refunds.id,status:refunds.status,amount:refunds.amountCents,reason:refunds.reason,date:refunds.createdAt,orderId:payments.orderId}).from(refunds).innerJoin(payments,eq(payments.id,refunds.paymentId))
    .where(global?undefined:sql`exists (select 1 from refund_ticket rt join ticket t on t.id=rt.ticket_id join order_item oi on oi.id=t.order_item_id join ticket_type tt on tt.id=oi.ticket_type_id join event e on e.id=tt.event_id where rt.refund_id=${refunds.id} and e.organizer_id=${actor.id}::uuid) and not exists (select 1 from refund_ticket rt join ticket t on t.id=rt.ticket_id join order_item oi on oi.id=t.order_item_id join ticket_type tt on tt.id=oi.ticket_type_id join event e on e.id=tt.event_id where rt.refund_id=${refunds.id} and e.organizer_id<>${actor.id}::uuid)`)
    .orderBy(desc(refunds.createdAt),desc(refunds.id)).limit(51).offset((page-1)*50);
  return <ManagementShell><main className="space-y-5 p-6"><h1 className="text-2xl font-bold">Reembolsos</h1><p>Las solicitudes se procesan con Stripe. El asiento se libera cuando la devolución se confirma.</p><div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Fecha</th><th className="p-3">Motivo</th><th className="p-3">Importe</th><th className="p-3">Estado</th></tr></thead><tbody>{rows.slice(0,50).map(row=><tr key={row.id} className="border-b"><td className="p-3">{new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'medium'}).format(row.date)}</td><td className="p-3">{row.reason.startsWith('event_cancelled')?'Evento cancelado':row.reason==='customer_request'?'Solicitud del comprador':'Devolución automática'}</td><td className="p-3">{new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(row.amount/100)}</td><td className="p-3">{labels[row.status]??'En revisión'}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-6">No hay reembolsos registrados.</p>}</div><nav className="flex gap-4" aria-label="Páginas de reembolsos">{page>1&&<Link href={`/organizador/reembolsos?page=${page-1}`}>Anterior</Link>}<span>Página {page}</span>{rows.length>50&&<Link href={`/organizador/reembolsos?page=${page+1}`}>Siguiente</Link>}</nav></main></ManagementShell>;
}
