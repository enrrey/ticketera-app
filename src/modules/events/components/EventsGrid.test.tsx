import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventsGrid } from "@/modules/events/components/EventsGrid";
import type { Event } from "@/modules/events/types";

const events: Event[] = [
  {
    id: "1",
    title: "Concierto de Rock",
    category: "concert",
    date: "2026-10-10T20:00:00.000Z",
    venue: "Estadio Nacional",
    city: "Lima",
    price: 150,
    currency: "PEN",
    imageUrl: "https://images.unsplash.com/photo-1668934804631-e8337c891e65",
    featured: true,
  },
  {
    id: "2",
    title: "Obra de Teatro",
    category: "theater",
    date: "2026-11-05T19:00:00.000Z",
    venue: "Teatro Municipal",
    city: "Arequipa",
    price: 80,
    currency: "PEN",
    imageUrl: "https://images.unsplash.com/photo-1651437524278-b37b83a6e6d3",
    featured: false,
  },
];

describe("EventsGrid", () => {
  it("renders skeleton placeholders while loading, without rendering cards", () => {
    render(<EventsGrid events={[]} isLoading />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText("Concierto de Rock")).not.toBeInTheDocument();
  });

  it("shows an empty state message and no cards or skeletons when there are no results", () => {
    render(<EventsGrid events={[]} isLoading={false} />);

    expect(
      screen.getByText("No se encontraron eventos con esos filtros")
    ).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it("renders one EventCard per event when data is available", () => {
    render(<EventsGrid events={events} isLoading={false} />);

    expect(screen.getByText("Concierto de Rock")).toBeInTheDocument();
    expect(screen.getByText("Obra de Teatro")).toBeInTheDocument();
    expect(
      screen.queryByText("No se encontraron eventos con esos filtros")
    ).not.toBeInTheDocument();
  });
});
