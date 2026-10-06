import { handleCreateCheckout } from "@/modules/checkout/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleCreateCheckout(request);
}
