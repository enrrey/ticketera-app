import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSeatHolds } from "./useSeatHolds";

const seat = { rowLabel: "A", seatNumber: 2 };
const items = [{ ticketTypeId: "zone", seats: [seat] }];
const serverTime = () => new Date().toISOString();
const expiry = () => new Date(Date.now() + 60_000).toISOString();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const available = (own: unknown = null) => ({ availability: [{ ticketTypeId: "zone", occupied: [] }], own, serverTime: serverTime() });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); });

it("confirms selections only after the lease response, serializes changes, stores a private token and releases with DELETE", async () => {
  let finish: (value: Response) => void = () => {};
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available())).mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useSeatHolds("event", true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  let request: Promise<void>;
  act(() => { request = result.current.change("zone", [seat]); });
  expect(result.current.busy).toBe(true);
  expect(result.current.selections).toEqual({});
  await act(async () => { await result.current.change("zone", [{ ...seat, seatNumber: 3 }]); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => { finish(response({ holdToken: "secret", items, expiresAt: expiry(), serverTime: serverTime() })); await request; });
  expect(result.current.selections.zone).toEqual([seat]);
  expect(result.current.confirmed).toBe(true);
  expect(result.current.remaining).toBe(60);
  expect(sessionStorage.getItem("ticketera:seat-hold:event")).toBe("secret");
  await act(async () => { await result.current.change("zone", []); });
  expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "DELETE", headers: { "x-seat-hold-token": "secret" } });
  expect(result.current.selections).toEqual({});
  expect(sessionStorage.getItem("ticketera:seat-hold:event")).toBeNull();
  expect(fetchMock.mock.calls.every(([url]) => !url.includes("secret"))).toBe(true);
});

it("reloads occupancy after a conflict and keeps the server's own selections", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available())).mockResolvedValueOnce(response({ code: "seat_unavailable" }, 409)).mockResolvedValueOnce(response({ ...available(), availability: [{ ticketTypeId: "zone", occupied: [seat] }] }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useSeatHolds("event", true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { await result.current.change("zone", [seat]); });
  expect(result.current.error).toMatch(/Otro comprador/);
  expect(result.current.availability[0].occupied).toEqual([seat]);
  expect(result.current.selections).toEqual({});
});

it("restores the private session lease and clears selections when its server deadline expires", async () => {
  vi.useFakeTimers();
  sessionStorage.setItem("ticketera:seat-hold:event", "restore-secret");
  const fetchMock = vi.fn().mockResolvedValue(response(available({ items, expiresAt: expiry() })));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useSeatHolds("event", true));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ "x-seat-hold-token": "restore-secret" });
  expect(result.current.selections.zone).toEqual([seat]);
  await act(async () => { vi.advanceTimersByTime(60_250); });
  expect(result.current.selections).toEqual({});
  expect(result.current.holdToken).toBeNull();
});
