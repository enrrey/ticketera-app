import { handleStaffUpdate, handleStaffUser } from "@/modules/identity-access";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  return handleStaffUpdate(request, (await context.params).userId);
}
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  return handleStaffUser(request, (await context.params).userId);
}
export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  return handleStaffUser(request, (await context.params).userId);
}
