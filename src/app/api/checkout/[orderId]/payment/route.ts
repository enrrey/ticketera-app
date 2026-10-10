import { handleCreatePayment } from "@/modules/payments/server";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return handleCreatePayment(request, (await context.params).orderId);
}
