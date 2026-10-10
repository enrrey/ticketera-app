'use client';
import {useRef,useState} from 'react';
import {loadStripe} from '@stripe/stripe-js';
import {CheckoutElementsProvider,PaymentElement,useCheckoutElements} from '@stripe/react-stripe-js/checkout';
import {Button} from '@/components/ui/button';
import {readOrderToken} from '../services/paymentClient';

function CardForm({disabled}:{disabled:boolean}) {
  const state=useCheckoutElements(); const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  async function confirm(){
    if(state.type!=='success'||disabled||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {const result=await state.checkout.confirm();if(result.type==='error')setError(result.error.message);}
    catch {setError('No pudimos confirmar el resultado. Revisa tu pedido antes de volver a intentar.');}
    finally {lock.current=false;setBusy(false);}
  }
  if(state.type==='error')return <p role="alert">No pudimos cargar el formulario de pago. Reabre tu pedido para intentarlo nuevamente.</p>;
  return <div className="grid gap-4"><h3 className="text-lg font-semibold">Pago con tarjeta</h3><PaymentElement/>{state.type==='loading'&&<p role="status">Cargando pago seguro…</p>}<Button type="button" disabled={disabled||busy||state.type!=='success'} onClick={confirm}>{busy?'Confirmando…':'Pagar entradas'}</Button>{error&&<p role="alert">{error}</p>}</div>;
}

export function InlinePayment({orderId,token,disabled=false}:{orderId:string;token?:string|null;disabled?:boolean}) {
  const [clientSecret,setClientSecret]=useState('');const [stripe,setStripe]=useState<ReturnType<typeof loadStripe>|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  async function open(){
    if(lock.current||disabled)return;lock.current=true;setBusy(true);setError('');
    try {
      const key=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;if(!key)throw new Error('El formulario de pago no está configurado.');
      const credential=token??readOrderToken(orderId);
      if(credential)window.sessionStorage.setItem(`ticketera:order:${orderId}`,credential);
      const response=await fetch(`/api/checkout/${encodeURIComponent(orderId)}/payment/form`,{method:'POST',cache:'no-store',headers:credential?{'x-order-token':credential}:{}});
      const body=await response.json();if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'No pudimos iniciar el pago.');
      // Existing hosted sessions keep their original payment surface and idempotency key.
      if(body.url){const url=new URL(body.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Respuesta de pago inválida');window.location.assign(url.toString());return;}
      if(typeof body.clientSecret!=='string'||!body.clientSecret.startsWith('cs_'))throw new Error('Respuesta de pago inválida');
      setStripe(loadStripe(key));setClientSecret(body.clientSecret);
    }catch(cause){setError(cause instanceof Error?cause.message:'No pudimos iniciar el pago.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="grid gap-3">{clientSecret&&stripe?<CheckoutElementsProvider stripe={stripe} options={{clientSecret}}><CardForm disabled={disabled}/></CheckoutElementsProvider>:<Button type="button" disabled={disabled||busy} onClick={open}>{busy?'Cargando pago seguro…':'Pagar con Stripe'}</Button>}{error&&<p role="alert">{error}</p>}</div>;
}
