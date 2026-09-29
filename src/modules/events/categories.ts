import {
  Baby,
  Clapperboard,
  Drama,
  Laugh,
  Music,
  Palette,
  PartyPopper,
  Presentation,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import type { EventCategory } from "./types";

export interface CategoryMeta {
  /** Singular label, used on badges (e.g. "Concierto"). */
  label: string;
  /** Plural label, used on the category filter (e.g. "Conciertos"). */
  filterLabel: string;
  icon: LucideIcon;
  /** Soft background + foreground Tailwind classes for the icon bubble. */
  toneClassName: string;
}

/**
 * Single source of truth for every per-category presentation detail
 * (labels, icon, color). Consumed by EventCard, FeaturedEventsHero and
 * CategoryFilter — never duplicate these maps elsewhere.
 */
export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  concert: {
    label: "Concierto",
    filterLabel: "Conciertos",
    icon: Music,
    toneClassName: "bg-violet-100 text-violet-700",
  },
  theater: {
    label: "Teatro",
    filterLabel: "Teatro",
    icon: Drama,
    toneClassName: "bg-rose-100 text-rose-700",
  },
  sports: {
    label: "Deportes",
    filterLabel: "Deportes",
    icon: Trophy,
    toneClassName: "bg-emerald-100 text-emerald-700",
  },
  festival: {
    label: "Festival",
    filterLabel: "Festivales",
    icon: PartyPopper,
    toneClassName: "bg-amber-100 text-amber-700",
  },
  conference: {
    label: "Conferencia",
    filterLabel: "Conferencias",
    icon: Presentation,
    toneClassName: "bg-sky-100 text-sky-700",
  },
  exhibition: {
    label: "Exhibición",
    filterLabel: "Exhibiciones",
    icon: Palette,
    toneClassName: "bg-fuchsia-100 text-fuchsia-700",
  },
  family: {
    label: "Familiar",
    filterLabel: "Familiar",
    icon: Baby,
    toneClassName: "bg-lime-100 text-lime-700",
  },
  comedy: {
    label: "Comedia",
    filterLabel: "Comedia",
    icon: Laugh,
    toneClassName: "bg-orange-100 text-orange-700",
  },
  cinema: {
    label: "Cine",
    filterLabel: "Cine",
    icon: Clapperboard,
    toneClassName: "bg-indigo-100 text-indigo-700",
  },
};
