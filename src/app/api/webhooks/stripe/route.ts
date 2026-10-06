import { handleStripeWebhook } from "@/modules/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
