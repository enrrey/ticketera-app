import {handleCancelEvent} from '@/modules/refunds/server';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){return handleCancelEvent(request,(await params).slug);}
