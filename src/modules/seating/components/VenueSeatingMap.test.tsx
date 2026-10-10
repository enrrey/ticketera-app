import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { VenueSeatingMap } from "./VenueSeatingMap";

it("selects saved tribunes with keyboard and pans and zooms the overview", () => {
  const onSectionSelect = vi.fn();
  render(<VenueSeatingMap venueName="Estadio Nacional" layout={{ enabled: true, template: "stadium", stagePosition: "south" }} sections={[{ id: "north", name: "Norte", zone: "Norte", seatingType: "numbered", capacity: 50, seatRows: [{ label: "A", seats: 50 }], priceCents: 2000, mapPosition: "north" }]} selectedSectionId="north" onSectionSelect={onSectionSelect} />);
  const tribune = screen.getByRole("button", { name: "Norte, 50 lugares" });
  expect(tribune).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(tribune, { key: "Enter" });
  expect(onSectionSelect).toHaveBeenCalledWith("north");
  const overview = screen.getByLabelText("Vista del estadio. Usa flechas para desplazar y más o menos para ampliar");
  fireEvent.keyDown(overview, { key: "+" });
  fireEvent.keyDown(overview, { key: "ArrowRight" });
  const graphic = screen.getByRole("group", { name: "Estadio: 1 zonas" });
  expect(graphic.firstElementChild).toHaveAttribute("transform", "translate(330 210) scale(1.25) translate(-300 -210)");
  fireEvent.click(screen.getByText("Restablecer"));
  expect(graphic.firstElementChild).toHaveAttribute("transform", "translate(300 210) scale(1) translate(-300 -210)");
});
