import { useQuery } from "@tanstack/react-query";

import type { Event } from "../types";

/** Shared real-event query; authorization and ownership are enforced by the API. */
export function useEvents(initialEvents?: Event[], options: { scope?: "public" | "organizer"; userId?: string | null } = {}) {
  const scope = options.scope ?? "public";
  return useQuery({
    queryKey: ["events", scope, scope === "organizer" ? options.userId : "public"],
    queryFn: async (): Promise<Event[]> => {
      const response = await fetch(`/api/events?scope=${scope}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("No pudimos cargar los eventos");
      return response.json();
    },
    enabled: scope === "public" || Boolean(options.userId),
    initialData: scope === "public" ? initialEvents : undefined,
    staleTime: scope === "public" ? 30_000 : 0,
    gcTime: scope === "public" ? 300_000 : 0,
    retry: false,
  });
}
