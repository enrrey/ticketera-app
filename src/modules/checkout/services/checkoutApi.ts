import { z } from "zod";
import { isSameOrigin } from "@/lib/sameOrigin";
import { getCurrentAccessUser } from "@/modules/identity-access";
import type { CheckoutErrorBody, CheckoutSummary, CreatedCheckout } from "../types";
import { checkoutSchema, type CheckoutInput } from "./checkoutSchema";
import { CheckoutError, createCheckout } from "./createCheckout";
import { getCheckout } from "./getCheckout";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
type Member = { id: string; status: string } | null;

type CreateDeps = { getMember: () => Promise<Member>; create: (input: CheckoutInput, member: Member) => Promise<CreatedCheckout> };
type ReadDeps = { getMember: () => Promise<Member>; read: (orderId: string, access: { userId: string | null; token: string | null }) => Promise<CheckoutSummary | null> };

const json = (body: CheckoutErrorBody | CheckoutSummary | CreatedCheckout, status = 200) => Response.json(body, { status, headers });

export async function handleCreateCheckout(
  request: Request,
  { getMember = getCurrentAccessUser, create = createCheckout }: Partial<CreateDeps> = {},
) {
  if (!isSameOrigin(request)) return json({ error: "Origen no permitido" }, 403);
  try {
    const input = checkoutSchema.parse(await request.json());
    const created = await create(input, await getMember());
    return json(created, 201);
  } catch (error) {
    if (error instanceof CheckoutError) return json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Revisa los datos de la compra" }, 400);
    return json({ error: "No pudimos reservar tus entradas. Inténtalo de nuevo." }, 503);
  }
}

export async function handleGetCheckout(
  request: Request,
  orderId: string,
  { getMember = getCurrentAccessUser, read = getCheckout }: Partial<ReadDeps> = {},
) {
  try {
    const member = await getMember();
    const summary = await read(orderId, { userId: member?.id ?? null, token: request.headers.get("x-order-token") });
    return summary ? json(summary) : json({ error: "Pedido no encontrado" }, 404);
  } catch {
    return json({ error: "No pudimos cargar tu pedido" }, 503);
  }
}
