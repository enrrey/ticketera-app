import { handleEventManagement } from "@/modules/events/server";
type Context = { params: Promise<{ slug: string }> };
async function handle(request: Request, context: Context) { return handleEventManagement(request, (await context.params).slug); }
export const GET = handle;
export const PATCH = handle;
export const DELETE = handle;
