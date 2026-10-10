"use client";
import { useEffect,useState } from 'react';
import Image from 'next/image';
import { readOrderToken } from '@/modules/payments';
import { Button } from '@/components/ui/button';
import type { TicketPage } from '../types';

export function OrderTickets({orderId,token}:{orderId:string;token?:string}) {
  const [page,setPage]=useState(1);
  const [data,setData]=useState<TicketPage>();
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const credential=token??readOrderToken(orderId);
    fetch(`/api/checkout/${orderId}/tickets?page=${page}`,{cache:'no-store',signal:controller.signal,headers:credential?{'x-order-token':credential}:{}})
      .then(async response=>{if(!response.ok)throw new Error('No pudimos cargar las entradas.');return response.json() as Promise<TicketPage>;})
      .then(value=>{if(!controller.signal.aborted){setData(value);setError('');}})
      .catch(()=>{if(!controller.signal.aborted)setError('No pudimos cargar las entradas. Recarga la página para reintentar.');});
    return ()=>controller.abort();
  },[orderId,token,page]);
  return <section className="grid gap-4" aria-label="Entradas de tu compra"><div><h2 className="text-xl font-semibold">Tus entradas {data?`(${data.total})`:''}</h2><p className="text-sm text-muted-foreground">Cada entrada tiene su propio QR. Presenta uno por persona al ingresar.</p></div>
    {error?<p role="alert">{error}</p>:!data?<p role="status">Cargando entradas…</p>:<>
      {!data.total&&<p>Estamos preparando tus entradas. Vuelve a cargar en unos momentos.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.tickets.map(ticket=><article key={ticket.id} className="grid justify-items-start gap-2 rounded-xl border bg-background p-5"><h3 className="font-semibold">{ticket.eventName}</h3><p>{ticket.ticketTypeName} · {ticket.zone}</p><p className="text-sm">{ticket.venue}{ticket.date?` · ${new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'medium',timeStyle:'short'}).format(new Date(ticket.date))}`:''}</p><strong>{ticket.seat?`Fila ${ticket.seat.row} · Asiento ${ticket.seat.number}`:'Ingreso general · sin asiento asignado'}</strong><small>Entrada {ticket.unitNumber} · {ticket.status==='valid'?'Válida':ticket.status==='used'?'Utilizada':'No disponible'}</small>
        {ticket.qrImage?<><Image src={ticket.qrImage} unoptimized width={220} height={220} alt={`Código QR de la entrada ${ticket.unitNumber}`} className="max-w-full bg-white"/><a className="text-sm underline" href={ticket.qrImage} download={`entrada-${ticket.id}.png`}>Descargar QR</a></>:<p className="text-sm">El QR no está disponible para esta entrada.</p>}
        <small className="break-all text-muted-foreground">{ticket.id}</small></article>)}</div>
      {data.total>data.pageSize&&<nav className="flex items-center gap-3" aria-label="Páginas de entradas"><Button variant="outline" disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</Button><span>Página {page} de {Math.ceil(data.total/data.pageSize)}</span><Button variant="outline" disabled={page*data.pageSize>=data.total} onClick={()=>setPage(page+1)}>Siguiente</Button></nav>}
    </>}</section>;
}
