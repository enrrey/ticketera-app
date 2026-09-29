import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoryFilter } from "@/modules/events/components/CategoryFilter";

describe("CategoryFilter", () => {
  it("calls onValueChange with the correct value when a category card is clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<CategoryFilter value="all" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Conciertos" }));

    expect(onValueChange).toHaveBeenCalledWith("concert");
  });

  it("reflects the active category based on the value prop via aria-pressed", () => {
    render(<CategoryFilter value="theater" onValueChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Teatro" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("renders the 'Todos' option plus one card per event category (10 total)", () => {
    render(<CategoryFilter value="all" onValueChange={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deportes" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Festivales" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conferencias" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exhibiciones" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Familiar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comedia" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cine" })).toBeInTheDocument();
  });

  it("highlights the active category's icon bubble with a primary ring", () => {
    render(<CategoryFilter value="sports" onValueChange={vi.fn()} />);

    const bubble = screen
      .getByRole("button", { name: "Deportes" })
      .querySelector("[data-slot='category-icon']");
    expect(bubble).toHaveClass("ring-primary");
  });
});
