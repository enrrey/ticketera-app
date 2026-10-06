import { handleGetCheckout } from "@/modules/checkout/server";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return handleGetCheckout(request, (await context.params).orderId);
}
