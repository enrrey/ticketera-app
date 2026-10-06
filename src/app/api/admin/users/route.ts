import { handleStaffUsers } from "@/modules/identity-access";
export const runtime = "nodejs";
export async function GET(request: Request) { return handleStaffUsers(request); }
export async function POST(request: Request) { return handleStaffUsers(request); }
