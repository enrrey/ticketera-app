import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TicketTypeEditor } from "./TicketTypeEditor";
import type { TicketTypeInput } from "../eventManagement.types";

it("builds numbered rows with derived capacity and rejects oversized builders", () => {
  const change = vi.fn();
  const option: TicketTypeInput = {name: "VIP", zone: "Platea", seatingType: "numbered", description: "", priceCents: 10000, capacity: 10, maxPerOrder: 6, peoplePerUnit: 1, seatRows: [{label: "A", seats: 10}], salesStartAt: "2030-01-01T10:00", salesEndAt: "2030-01-01T18:00", sessionIndexes: [0]};
  render(<TicketTypeEditor value={[option]} sessions={[{startsAt: "2030-01-01T20:00", endsAt: "2030-01-01T23:00"}]} readonly={false} onChange={change}/>);
  fireEvent.change(screen.getByLabelText("Número de filas de entrada 1"), {target: {value: "3"}});
  fireEvent.change(screen.getByLabelText("Asientos por fila de entrada 1"), {target: {value: "12"}});
  fireEvent.click(screen.getByRole("button", {name: "Reemplazar filas con esta distribución"}));
  expect(change).toHaveBeenLastCalledWith([expect.objectContaining({capacity: 36, seatRows: [{label: "Fila 1", seats: 12}, {label: "Fila 2", seats: 12}, {label: "Fila 3", seats: 12}]})]);
  fireEvent.change(screen.getByLabelText("Número de filas de entrada 1"), {target: {value: "101"}});
  expect(screen.getByRole("button", {name: "Reemplazar filas con esta distribución"})).toBeDisabled();
});
