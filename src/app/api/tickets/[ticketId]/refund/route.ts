import {handleTicketRefund} from '@/modules/refunds/server';
export async function POST(request:Request,{params}:{params:Promise<{ticketId:string}>}){return handleTicketRefund(request,(await params).ticketId);}
