"use client";
import {useState,useSyncExternalStore} from 'react';
import {Heart,Share2} from 'lucide-react';
import {Button} from '@/components/ui/button';
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener('ticketera-favorite',listener);return ()=>{window.removeEventListener('storage',listener);window.removeEventListener('ticketera-favorite',listener);};}
export function EventActions({eventId,title}:{eventId:string;title:string}){
  const [message,setMessage]=useState('');
  const key=`ticketera:favorite:${eventId}`;
  const saved=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)==='true';}catch{return false;}},()=>false);
  function toggle(){try{localStorage.setItem(key,String(!saved));window.dispatchEvent(new Event('ticketera-favorite'));setMessage(!saved?'Evento guardado en este navegador.':'Evento eliminado de tus guardados.');}catch{setMessage('No se pudo guardar en este navegador.');}}
  async function share(){try{if(navigator.share)await navigator.share({title,url:window.location.href});else{await navigator.clipboard.writeText(window.location.href);setMessage('Enlace copiado.');}}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage('No se pudo compartir el enlace.');}}
  return <div className="grid gap-2"><div className="flex flex-wrap gap-2"><Button variant="outline" aria-pressed={saved} onClick={toggle}><Heart size={18} fill={saved?'currentColor':'none'}/>{saved?'Guardado':'Guardar evento'}</Button><Button variant="outline" onClick={share}><Share2 size={18}/>Compartir</Button></div>{message&&<p role="status" className="text-sm">{message}</p>}</div>;
}
