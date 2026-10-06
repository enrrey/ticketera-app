import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrganizerDashboard } from "./OrganizerDashboard";
import { ApplicationAccessProvider } from "@/modules/identity-access/client";
const state = vi.hoisted(() => ({ result: { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() }, userId: "owner" as string | null }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: state.userId, isLoaded: true }) }));
vi.mock("../hooks/useEvents", () => ({ useEvents: vi.fn(() => state.result) }));
beforeEach(() => { state.userId = "owner"; state.result = { data: [], isPending: false, isError: false, refetch: vi.fn() }; });
afterEach(()=>vi.unstubAllGlobals());
it("opens the creation form for an active super admin from the event list",async()=>{
  render(<ApplicationAccessProvider user={{id:"admin",clerkUserId:"owner",email:"admin@example.com",name:"Admin",status:"active",roles:["super_admin"],permissions:["events.manage","events.publish"],overrides:{}}}><OrganizerDashboard/></ApplicationAccessProvider>);
  fireEvent.click(screen.getByRole("button",{name:"Crear evento"}));
  expect(await screen.findByRole("dialog",{name:"Crear evento"})).toBeInTheDocument();
  expect(within(screen.getByRole("dialog",{name:"Crear evento"})).getByLabelText("Nombre")).toBeEnabled();
  expect(screen.getByText("Destacado en el hero")).toBeInTheDocument();
});
it("persists an admin highlight from the list without sending ticket conditions",async()=>{
  const fetchMock=vi.fn().mockResolvedValue(Response.json({featured:true}));vi.stubGlobal("fetch",fetchMock);
  state.result.data=[{id:"one",title:"Evento real",venue:"Local",city:"Lima",imageUrl:"/images/events/zayn.jpg",date:"2030-01-01",status:"draft",featured:false}];
  render(<ApplicationAccessProvider user={{id:"admin",clerkUserId:"owner",email:"admin@example.com",name:"Admin",status:"active",roles:["admin"],permissions:["events.manage"],overrides:{}}}><OrganizerDashboard/></ApplicationAccessProvider>);
  fireEvent.click(screen.getByRole("button",{name:"Destacar Evento real"}));
  await waitFor(()=>expect(state.result.refetch).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledWith("/api/events/one",expect.objectContaining({method:"PATCH",body:JSON.stringify({featured:true})}));
});
it("shows actual event totals and published states", () => {
  state.result.data = [{ id: "one", title: "Real event", venue: "Local", city: "Lima", imageUrl: "/images/events/zayn.jpg", date: "2026-10-14", status: "published", ticketsIssued: 3, netRevenueCents: 12345 }, { id: "two", title: "Draft", venue: "Local", city: "Lima", imageUrl: "/images/events/zayn.jpg", status: "draft", ticketsIssued: 0, netRevenueCents: 0 }];
  render(<OrganizerDashboard />);
  expect(screen.getAllByText("3")).toHaveLength(2); expect(screen.getByText("1")).toBeInTheDocument();
  expect(screen.getAllByText(/123[.,]45/)).toHaveLength(2);
  expect(screen.getByText("Borrador", { selector: "span" })).toBeInTheDocument(); expect(screen.getByText("Publicado", { selector: "span" })).toBeInTheDocument();
  expect(screen.queryByText(/ficticias|demostración/)).not.toBeInTheDocument();
});
it("renders empty and error states without invented metrics", () => {
  const view = render(<OrganizerDashboard />); expect(screen.getByText("Todavía no tienes eventos registrados.")).toBeInTheDocument();
  state.result.isError = true; view.rerender(<OrganizerDashboard />);
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar"); expect(screen.getByRole("button", { name: "Volver a intentar" })).toBeInTheDocument();
});
it("hides cached event data when the session is signed out", () => {
  state.userId = null; state.result.data = [{ title: "Private cached" }]; render(<OrganizerDashboard />);
  expect(screen.queryByText("Private cached")).not.toBeInTheDocument();
});
it("combines name, status and inclusive Peru dates and resets the filters", () => {
  state.result.data = [
    { id: "one", title: "Música nocturna", venue: "Local", city: "Lima", imageUrl: "/images/events/zayn.jpg", date: "2026-10-15T02:00:00Z", status: "published" },
    { id: "two", title: "Música futura", venue: "Local", city: "Lima", imageUrl: "/images/events/zayn.jpg", date: "2026-10-16T20:00:00Z", status: "draft" },
  ];
  render(<OrganizerDashboard />);
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "musica" } });
  fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "published" } });
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-14" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-14" } });
  expect(screen.getByText("Música nocturna")).toBeInTheDocument();
  expect(screen.queryByText("Música futura")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "inexistente" } });
  expect(screen.getByText("No hay eventos que coincidan con los filtros.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(screen.getByText("Música futura")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Crear evento" }).closest(".portal-table-card")).not.toBeNull();
});
