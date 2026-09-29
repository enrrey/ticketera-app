import { useQuery } from "@tanstack/react-query";

import { getEvents } from "../services/eventsService";
import type { Event } from "../types";

/**
 * Thin `useQuery` wrapper around `eventsService.getEvents`. Contains no
 * branching logic of its own: loading/error/data states are exposed as-is
 * from React Query for consumers (e.g. `EventsGrid`) to handle.
 */
export function useEvents(initialEvents?: Event[]) {
  return useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
    initialData: initialEvents,
    staleTime: Infinity,
  });
}
