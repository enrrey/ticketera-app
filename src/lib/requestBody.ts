// Ten checkout lines may each contain 1,000 seats and UTF-8 row labels.
const MAX_JSON_BODY_BYTES = 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() { super("El cuerpo de la solicitud es demasiado grande"); }
}

/** Bound actual streamed bytes before parsing; Content-Length is only an early rejection. */
export async function readRequestJson(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("Empty JSON body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}
