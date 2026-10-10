"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
export function RefundButton({ticketId}:{ticketId:string}) {
  const router=useRouter();
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function request(){
    if(busy)return;
    setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/tickets/${ticketId}/refund`,{method:'POST'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'No pudimos solicitar la devolución');
      setMessage('Solicitud registrada. El QR queda bloqueado mientras se procesa la devolución.');
      setConfirming(false);router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'No pudimos solicitar la devolución');}
    finally{setBusy(false);}
  }
  return <div className="grid gap-2 text-sm">
    {!confirming?<Button variant="outline" onClick={()=>setConfirming(true)}>Solicitar reembolso</Button>:<>
      <p>Se devuelve únicamente esta entrada. Disponible hasta 48 horas antes del evento; al solicitarlo su QR deja de ser válido.</p>
      <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={request}>{busy?'Solicitando…':'Confirmar devolución'}</Button><Button variant="outline" disabled={busy} onClick={()=>setConfirming(false)}>Volver</Button></div>
    </>}
    {message&&<p role="status">{message}</p>}
  </div>;
}
