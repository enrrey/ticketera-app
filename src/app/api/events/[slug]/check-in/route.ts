import {handleCheckIn} from '@/modules/tickets/server';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){return handleCheckIn(request,(await params).slug);}
