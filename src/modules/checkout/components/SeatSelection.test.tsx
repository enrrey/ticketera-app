import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SeatSelection } from "./SeatSelection";

it("renders bounded rows and seats, blocks occupied coordinates and returns the configured coordinate", () => {
  const onChange = vi.fn();
  render(<SeatSelection option={{ id: "numbered", name: "Platea", zone: "Norte", description: "", priceCents: 1000, available: 10, maxPerOrder: 2, salesStartAt: "2020-01-01", salesEndAt: "2030-01-01", seatingType: "numbered", seatRows: Array.from({ length: 100 }, (_, index) => ({ label: `F${index + 1}`, seats: 500 })) }} selected={[]} unavailable={[{ rowLabel: "F1", seatNumber: 1 }]} onChange={onChange} />);
  expect(screen.getByLabelText("Fila F1, asiento 1, ocupado")).toBeDisabled();
  expect(screen.queryByLabelText("Fila F9, asiento 1")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Fila F1, asiento 51")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Fila F1, asiento 2"));
  expect(onChange).toHaveBeenCalledWith([{ rowLabel: "F1", seatNumber: 2 }]);
  fireEvent.click(screen.getByText("Asientos siguientes"));
  expect(screen.getByLabelText("Fila F1, asiento 51")).toBeEnabled();
  fireEvent.click(screen.getByText("Filas siguientes"));
  expect(screen.getByLabelText("Fila F9, asiento 1")).toBeEnabled();
});
