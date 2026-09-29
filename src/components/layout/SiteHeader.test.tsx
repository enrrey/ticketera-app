import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader", () => {
  it("calls onSearchChange with the typed value", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(<SiteHeader searchValue="" onSearchChange={onSearchChange} />);

    const searchInput = screen.getByRole("searchbox", {
      name: /buscar eventos/i,
    });
    await user.type(searchInput, "rock");

    expect(onSearchChange).toHaveBeenCalledTimes(4);
    expect(onSearchChange).toHaveBeenLastCalledWith("k");
  });

  it("reflects the controlled searchValue prop", () => {
    render(<SiteHeader searchValue="jazz" onSearchChange={() => {}} />);

    const searchInput = screen.getByRole("searchbox", {
      name: /buscar eventos/i,
    }) as HTMLInputElement;

    expect(searchInput.value).toBe("jazz");
  });
});
