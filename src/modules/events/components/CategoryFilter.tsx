"use client";

import { LayoutGrid, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { CATEGORY_META, type CategoryMeta } from "../categories";
import type { EventCategory } from "../types";

export type CategoryFilterValue = EventCategory | "all";

interface CategoryOption {
  value: CategoryFilterValue;
  label: string;
  icon: LucideIcon;
  toneClassName: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: "all",
    label: "Todos",
    icon: LayoutGrid,
    toneClassName: "bg-muted text-foreground",
  },
  ...(Object.entries(CATEGORY_META) as [EventCategory, CategoryMeta][]).map(
    ([value, meta]) => ({
      value,
      label: meta.filterLabel,
      icon: meta.icon,
      toneClassName: meta.toneClassName,
    })
  ),
];

export interface CategoryFilterProps {
  value: CategoryFilterValue;
  onValueChange: (value: CategoryFilterValue) => void;
}

/**
 * Horizontally scrollable row of round category icons (Eventbrite/Fever
 * style). The active option is exposed via `aria-pressed` and a primary
 * ring around its icon bubble.
 */
export function CategoryFilter({ value, onValueChange }: CategoryFilterProps) {
  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:justify-between lg:px-0 [&::-webkit-scrollbar]:hidden">
      {CATEGORY_OPTIONS.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onValueChange(option.value)}
            className="group flex w-20 shrink-0 snap-start flex-col items-center gap-2 rounded-xl py-1 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          >
            <span
              data-slot="category-icon"
              className={cn(
                "flex size-16 items-center justify-center rounded-full transition-transform group-hover:-translate-y-0.5",
                option.toneClassName,
                isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <Icon className="size-7" aria-hidden="true" />
            </span>
            <span
              className={cn(
                "text-center",
                isActive ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
