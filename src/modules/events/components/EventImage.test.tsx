import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("next/image", () => ({ default: ({ src, alt, unoptimized }: { src: string; alt: string; unoptimized: boolean }) => <span role="img" aria-label={alt} data-src={src} data-unoptimized={String(unoptimized)} /> }));
import { EventImage } from "./EventImage";
it("renders accepted HTTPS schemes directly after trimming whitespace", () => {
  render(<EventImage src="  HTTPS://cdn.example.com/cover.jpg  " alt="Portada" width={100} height={100} />);
  expect(screen.getByRole("img", { name: "Portada" })).toHaveAttribute("data-src", "HTTPS://cdn.example.com/cover.jpg");
  expect(screen.getByRole("img", { name: "Portada" })).toHaveAttribute("data-unoptimized", "true");
});
