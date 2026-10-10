import { handleGetSeatAvailability,handleSeatHolds } from "@/modules/checkout/server";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return handleGetSeatAvailability((await params).eventId,request);
}
export async function POST(request:Request,{params}:{params:Promise<{eventId:string}>}){return handleSeatHolds(request,(await params).eventId);}
export async function DELETE(request:Request,{params}:{params:Promise<{eventId:string}>}){return handleSeatHolds(request,(await params).eventId);}
