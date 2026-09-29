import { EventCard } from "@/modules/events/components/EventCard";
import { EventCardSkeleton } from "@/modules/events/components/EventCardSkeleton";
import type { Event } from "@/modules/events/types";

const SKELETON_COUNT = 8;

interface EventsGridProps {
  events: Event[];
  isLoading: boolean;
  savedIds?: string[];
  onToggleSaved?: (id: string) => void;
}

/**
 * Orchestrates the loading / empty / data states of the events grid.
 * Data fetching and filtering live outside this component; it only
 * decides what to render for a given `events`/`isLoading` combination.
 */
export function EventsGrid({ events, isLoading, savedIds, onToggleSaved }: EventsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No se encontraron eventos con esos filtros
      </p>
    );
  }

  return (
    <div className="events-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} saved={savedIds?.includes(event.id)} onToggleSaved={onToggleSaved} />
      ))}
    </div>
  );
}
