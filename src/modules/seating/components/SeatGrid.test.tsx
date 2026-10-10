import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeatGrid } from "./SeatGrid";
import type { MapSection } from "../types";

const section: MapSection = { name: "Norte", zone: "Norte", seatingType: "numbered", capacity: 900, priceCents: 1000, seatRows: Array.from({ length: 9 }, (_, i) => ({ label: String.fromCharCode(65 + i), seats: i === 8 ? 60 : 100 })) };
const smallSection = { ...section, capacity: 4, seatRows: [{ label: "A", seats: 4 }] };

describe("SeatGrid", () => {
  it("zooms, pans with keyboard and restores the view", () => {
    render(<SeatGrid section={smallSection} selected={[]} occupied={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Acercar plano" }));
    expect(screen.getByText("125%" )).toBeInTheDocument();
    const viewport = screen.getByRole("region", { name: "Plano de asientos" });
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    expect(viewport.scrollLeft).toBe(80);
    fireEvent.click(screen.getByRole("button", { name: "Restablecer vista" }));
    expect(screen.getByText("100%" )).toBeInTheDocument();
    expect(viewport.scrollLeft).toBe(0);
  });

  it("navigates real rows through the minimap and preserves seat numbering", () => {
    render(<SeatGrid section={section} selected={[]} occupied={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver fila I, 60 asientos" }));
    expect(screen.getByRole("button", { name: "Fila I, asiento 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Asientos siguientes" }));
    expect(screen.getByRole("button", { name: "Fila I, asiento 60" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fila I, asiento 61" })).not.toBeInTheDocument();
  });

  it("pans the background with the mouse and stops on release", () => {
    render(<SeatGrid section={smallSection} selected={[]} occupied={[]} onToggle={vi.fn()} />);
    const viewport = screen.getByRole("region", { name: "Plano de asientos" });
    viewport.setPointerCapture = vi.fn();
    const pointer = (type: string, x: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerType: "mouse", pointerId: 1, button: 0, clientX: x, clientY: 100 });
      fireEvent(viewport, event);
    };
    pointer("pointerdown", 100);
    pointer("pointermove", 40);
    expect(viewport.scrollLeft).toBe(60);
    pointer("pointerup", 40);
    pointer("pointermove", 20);
    expect(viewport.scrollLeft).toBe(60);
  });

  it("keeps occupied seats blocked and allows deselection at the cap", () => {
    const onToggle = vi.fn();
    render(<SeatGrid section={smallSection} selected={[{ rowLabel: "A", seatNumber: 1 }]} occupied={[{ rowLabel: "A", seatNumber: 2 }]} maxSelected={1} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Fila A, asiento 2, ocupado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fila A, asiento 3" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Fila A, asiento 1" }));
    expect(onToggle).toHaveBeenCalledWith({ rowLabel: "A", seatNumber: 1 });
  });
});
