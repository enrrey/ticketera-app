// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./sameOrigin";

const request = (origin?: string) => new Request("http://localhost:3000/api/x", { method: "POST", headers: origin ? { origin } : {} });

describe("isSameOrigin", () => {
  it("accepts the site's own origin", () => expect(isSameOrigin(request("http://localhost:3000"))).toBe(true));
  it("rejects a missing origin", () => expect(isSameOrigin(request())).toBe(false));
  it("rejects a foreign origin or a different port", () => {
    expect(isSameOrigin(request("https://evil.example"))).toBe(false);
    expect(isSameOrigin(request("http://localhost:3001"))).toBe(false);
  });
});
