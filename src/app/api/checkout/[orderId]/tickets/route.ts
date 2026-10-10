import { handleOrderTickets } from '@/modules/tickets/server';
export async function GET(request:Request,{params}:{params:Promise<{orderId:string}>}) {
  return handleOrderTickets(request,(await params).orderId);
}
