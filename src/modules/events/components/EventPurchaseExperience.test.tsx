import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getEventById } from "../services/eventsService";
import { EventPurchaseExperience } from "./EventPurchaseExperience";

describe("event purchase UI prototype", () => {
  it("selects a zone, updates the quantity and completes a local checkout", async () => {
    const event = await getEventById("zayn");
    if (!event) throw new Error("Missing sample event");
    const user = userEvent.setup();
    render(<EventPurchaseExperience event={event} />);

    await user.click(screen.getByRole("button", { name: /^Platinum,/ }));
    await user.click(screen.getByRole("button", { name: "Fila A, asiento 2, disponible" }));
    await user.click(screen.getByRole("button", { name: "Fila A, asiento 3, disponible" }));
    expect(screen.getByText("S/ 978")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.type(screen.getByLabelText(/Nombre completo/), "Ana Pérez");
    await user.type(screen.getByLabelText(/Correo electrónico/), "ana@example.com");
    await user.type(screen.getByLabelText(/DNI \/ documento/), "12345678");
    await user.type(screen.getByLabelText(/Celular/), "999888777");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Confirmar compra de prueba/ }));

    expect(screen.getByRole("heading", { name: "¡Tu noche ya tiene fecha!" })).toBeInTheDocument();
    expect(screen.getByText(/no se realizó ningún cobro/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR ilustrativo/ })).toBeInTheDocument();
  }, 15_000);
});
