import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { EventConfigurationPreview } from "./EventConfigurationPreview";

it("updates the real venue query and bounds numbered row rendering", () => {
  const options = [{name: "VIP", zone: "Platea", seatingType: "numbered" as const, capacity: 50000, seatRows: Array.from({length: 100}, (_, index) => ({label: `Fila ${index + 1}`, seats: 500}))}];
  const { rerender } = render(<EventConfigurationPreview venue="Teatro real" address="Av. Uno 123" city="Lima" options={options} layout={{enabled:true,template:"stadium",stagePosition:"north"}}/>);
  expect(screen.getByRole("link")).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Teatro real, Av. Uno 123, Lima"));
  expect(screen.getByText("Filas 1/13")).toBeInTheDocument();
  expect(screen.getByLabelText("Fila Fila 1, asiento 1")).toBeDisabled();
  expect(screen.queryByLabelText("Fila Fila 9, asiento 1")).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Ver fila Fila 9, 500 asientos'})).toBeInTheDocument();
  rerender(<EventConfigurationPreview venue="Estadio nuevo" address="Calle Dos 456" city="Cusco" options={[{...options[0], seatingType: "standing"}]}/>);
  expect(screen.getByRole("link")).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Estadio nuevo, Calle Dos 456, Cusco"));
  expect(screen.queryByLabelText("Distribución de Platea")).not.toBeInTheDocument();
  expect(screen.getByText(/De pie, sin asiento asignado/)).toBeInTheDocument();
});
