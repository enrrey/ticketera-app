import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Event } from "../types";
import { EventCard } from "./EventCard";

const eventFixture: Event = {
  id: "1",
  title: "Concierto de Rock Sinfónico",
  category: "concert",
  date: "2026-12-24T20:00:00.000Z",
  venue: "Gran Teatro Nacional",
  city: "Lima",
  price: 45,
  currency: "USD",
  imageUrl: "https://images.unsplash.com/photo-1668934804631-e8337c891e65",
  featured: true,
};

describe("EventCard", () => {
  it("renders a calendar-style date badge with day and short month", () => {
    render(<EventCard event={eventFixture} />);

    const badge = screen.getByTestId("event-date-badge");
    expect(badge).toHaveTextContent("24");
    expect(badge).toHaveTextContent("DIC");
    expect(screen.queryByText(eventFixture.date)).not.toBeInTheDocument();
  });

  it("omits the date badge when the date is invalid", () => {
    render(<EventCard event={{ ...eventFixture, date: "not-a-date" }} />);

    expect(screen.queryByTestId("event-date-badge")).not.toBeInTheDocument();
  });

  it("prefixes the price with 'Desde'", () => {
    render(<EventCard event={eventFixture} />);

    expect(screen.getByText(/Desde/)).toBeInTheDocument();
  });

  it("renders the formatted price", () => {
    render(<EventCard event={eventFixture} />);

    expect(screen.getByText(/45,00/)).toBeInTheDocument();
  });

  it("renders the category badge with a human-readable label", () => {
    render(<EventCard event={eventFixture} />);

    expect(screen.getByText("Concierto")).toBeInTheDocument();
  });

  it("renders the label for a new category (comedy)", () => {
    render(<EventCard event={{ ...eventFixture, category: "comedy" }} />);

    expect(screen.getByText("Comedia")).toBeInTheDocument();
  });

  it("renders the event title, venue and city", () => {
    render(<EventCard event={eventFixture} />);

    expect(screen.getByText(eventFixture.title)).toBeInTheDocument();
    expect(screen.getByText(/Gran Teatro Nacional, Lima/)).toBeInTheDocument();
  });

  it("renders an image with a non-empty, descriptive alt text", () => {
    render(<EventCard event={eventFixture} />);

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("alt", eventFixture.title);
  });
});
