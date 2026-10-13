// @vitest-environment node
import { expect, it, vi } from "vitest";
import { readRequestJson, RequestBodyTooLargeError } from "./requestBody";

function streamed(chunks: string[], contentLength?: string) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(new TextEncoder().encode(chunk));
    }, cancel,
  });
  const request = new Request("https://app.test", {
    method: "POST", body, duplex: "half",
    headers: contentLength ? { "content-length": contentLength } : {},
  } as RequestInit);
  return { request, cancel };
}

it("parses JSON across split multibyte UTF-8 chunks", async () => {
  const encoded = new TextEncoder().encode('{"name":"á"}');
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(encoded.slice(0, 10)); controller.enqueue(encoded.slice(10)); controller.close();
  } });
  const request = new Request("https://app.test", { method: "POST", body, duplex: "half" } as RequestInit);
  await expect(readRequestJson(request, encoded.length)).resolves.toEqual({ name: "á" });
});
it.each([undefined, "1", "invalid"])("rejects and cancels oversized streamed bytes with Content-Length %s", async (length) => {
  const { request, cancel } = streamed(['{"x":"', "ááá", '"}', "remaining"], length);
  await expect(readRequestJson(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  expect(cancel).toHaveBeenCalled();
});
it("rejects an oversized declared length before consuming the body", async () => {
  const { request, cancel } = streamed(["{}"], "11");
  await expect(readRequestJson(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  expect(cancel).toHaveBeenCalled();
});
it("preserves SyntaxError for malformed or empty JSON", async () => {
  await expect(readRequestJson(streamed(["{bad"]).request)).rejects.toBeInstanceOf(SyntaxError);
  await expect(readRequestJson(new Request("https://app.test", { method: "POST" }))).rejects.toBeInstanceOf(SyntaxError);
});
