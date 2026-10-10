import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/modules/identity-access", () => ({
  requirePermission: mocks.requirePermission,
  AccessError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
vi.mock("./profileService", () => ({ readOrganizerProfile: mocks.read, saveOrganizerProfile: mocks.save }));
import { handleOrganizerProfile } from "./profileApi";

describe("organizer profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "own-user", status: "active", roles: ["organizer"], permissions: ["events.manage"] });
    mocks.read.mockResolvedValue({ businessName: "Own", ruc: "12345678901", updatedAt: null });
    mocks.save.mockResolvedValue({ businessName: "Own", ruc: "12345678901", updatedAt: null });
  });
  it("reads the authenticated owner and marks missing external status unavailable", async () => {
    const response = await handleOrganizerProfile(new Request("https://app.test/api/organizer-profile"));
    expect(mocks.read).toHaveBeenCalledWith("own-user");
    expect((await response.json()).connect).toEqual({ available: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin mutations before saving", async () => {
    const response = await handleOrganizerProfile(new Request("https://app.test/api/organizer-profile", { method: "PUT", headers: { origin: "https://evil.test" }, body: "{}" }));
    expect(response.status).toBe(403); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects customers even when granted events permission", async () => {
    mocks.requirePermission.mockResolvedValue({ status: "active", roles: ["customer"], permissions: ["events.manage"] });
    expect((await handleOrganizerProfile(new Request("https://app.test/api/organizer-profile"))).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("saves own profile and returns actual injected Connect status", async () => {
    const connect = { available: true, chargesEnabled: false, payoutsEnabled: true, detailsSubmitted: true };
    const reader = vi.fn().mockResolvedValue(connect);
    const response = await handleOrganizerProfile(new Request("https://app.test/api/organizer-profile", { method: "PUT", headers: { origin: "https://app.test" }, body: JSON.stringify({ businessName: "Own", ruc: "12345678901" }) }), reader);
    expect(mocks.save).toHaveBeenCalledWith("own-user", { businessName: "Own", ruc: "12345678901" });
    expect((await response.json()).connect).toEqual(connect);
  });
  it("keeps successful saves successful when external status is unavailable", async () => {
    const response = await handleOrganizerProfile(new Request("https://app.test/api/organizer-profile", { method: "PUT", headers: { origin: "https://app.test" }, body: "{}" }), vi.fn().mockRejectedValue(new Error("provider")));
    expect(response.status).toBe(200); expect((await response.json()).connect.available).toBe(false);
  });
});
