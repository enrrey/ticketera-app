import { handleClerkWebhook } from "@/modules/identity-access";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) { return handleClerkWebhook(request); }
