import {handleCreatePayment} from '@/modules/payments/server';
export async function POST(request:Request,{params}:{params:Promise<{orderId:string}>}) {
  return handleCreatePayment(request,(await params).orderId,{},'elements');
}
