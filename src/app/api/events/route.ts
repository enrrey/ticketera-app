import { handleEventListing, handleEventManagement } from "@/modules/events/server";
export const GET = handleEventListing;
export async function POST(request: Request) { return handleEventManagement(request); }
