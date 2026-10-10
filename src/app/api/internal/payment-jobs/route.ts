import { handlePaymentJobs } from "@/modules/payments/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) { return handlePaymentJobs(request); }
