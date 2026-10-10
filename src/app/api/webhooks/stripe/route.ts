import { handleStripeWebhook } from "@/modules/payments/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
