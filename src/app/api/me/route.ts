import { handleCurrentUser } from "@/modules/identity-access";
export const runtime = "nodejs";
export async function GET() { return handleCurrentUser(); }
