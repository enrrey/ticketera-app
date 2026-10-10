import Image from 'next/image';
import Link from 'next/link';
import { listOwnTickets } from '@/modules/tickets/server';
import type { OwnTicketPage } from '@/modules/tickets';
import {RefundButton} from '@/modules/refunds/RefundButton';

const statusLabels:Record<string,string>={valid:'Válida',used:'Utilizada',refund_pending:'Reembolso pendiente',refunded:'Reembolsada',cancelled:'Cancelada'};
const formatSession=(date:string)=>new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'medium',timeStyle:'short'}).format(new Date(date));

export async function MyTicketsPage({userId,page=1}:{userId:string;page?:number}) {
  let data:OwnTicketPage|undefined;
  try { data=await listOwnTickets(userId,page); } catch { /* Display a recoverable error without exposing private details. */ }
  return <main className="page-shell grid gap-6 py-10">
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Mi cuenta"><Link href="/">Volver a eventos</Link><Link href="/mis-compras" className="underline">Mis compras</Link><Link href="/mis-entradas" aria-current="page" className="underline">Mis entradas</Link></nav>
    <header><h1 className="text-3xl font-semibold">Mis entradas</h1><p className="mt-2 text-muted-foreground">Cada entrada tiene su propio QR. Presenta una entrada válida por persona al ingresar.</p></header>
    {!data?<section className="rounded-xl border p-8"><p role="alert">No pudimos cargar tus entradas. Inténtalo nuevamente.</p><Link className="mt-4 inline-block underline" href={`/mis-entradas?page=${page}`}>Reintentar</Link></section>:<>
      {!data.total?<section className="rounded-xl border p-8"><h2 className="font-semibold">Todavía no tienes entradas</h2><p className="mt-2">Tus entradas aparecerán después de confirmar el pago. Las compras como invitado se vinculan al iniciar sesión con el mismo correo verificado.</p><Link href="/" className="mt-4 inline-block underline">Explorar eventos</Link></section>:!data.tickets.length?<p>No hay entradas en esta página. <Link href="/mis-entradas" className="underline">Volver a la primera página</Link></p>:<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.tickets.map(ticket=><article key={ticket.id} className="grid justify-items-start gap-3 rounded-xl border p-5">
        <h2 className="font-semibold">{ticket.eventName}</h2><p>{ticket.ticketTypeName} · {ticket.zone}</p><p>{ticket.venue}</p>
        {ticket.sessions.length?<ul className="grid gap-1 text-sm" aria-label="Sesiones incluidas">{ticket.sessions.map(session=><li key={session.id}>{formatSession(session.startsAt)}</li>)}</ul>:<p className="text-sm">Sesión por confirmar</p>}
        <strong>{ticket.seat?`Fila ${ticket.seat.row} · Asiento ${ticket.seat.number}`:'Ingreso general · sin asiento asignado'}</strong><span className="rounded bg-muted px-2 py-1 text-sm">{statusLabels[ticket.status]??'No disponible'}</span>
        {ticket.qrImage?<><Image src={ticket.qrImage} unoptimized width={220} height={220} alt={`Código QR de la entrada ${ticket.unitNumber} para ${ticket.eventName}`} className="max-w-full bg-white"/><a className="text-sm underline" href={ticket.qrImage} download={`entrada-${ticket.id}.png`}>Descargar QR</a></>:<p className="text-sm">El QR no está disponible para esta entrada.</p>}
        <small className="break-all text-muted-foreground">Entrada {ticket.id}</small><Link href={`/pedidos/${ticket.orderId}`} className="text-sm underline">Ver compra</Link>
        {ticket.status==='valid'&&<RefundButton ticketId={ticket.id}/>}
      </article>)}</div>}
      {data.total>data.pageSize&&<nav className="flex gap-4" aria-label="Páginas de entradas">{data.page>1&&<Link href={`/mis-entradas?page=${data.page-1}`} className="underline">Anterior</Link>}<span>Página {data.page} de {Math.ceil(data.total/data.pageSize)}</span>{data.page*data.pageSize<data.total&&<Link href={`/mis-entradas?page=${data.page+1}`} className="underline">Siguiente</Link>}</nav>}
    </>}
  </main>;
}
