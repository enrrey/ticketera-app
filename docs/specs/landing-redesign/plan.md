# Rediseño de la landing — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Llevar la landing `/` a un diseño moderno en modo claro: hero en carrusel legible, categorías en fila de íconos, "Próximos eventos" ordenados por fecha y topbar sticky con búsqueda + fecha + precio.

**Architecture:** Todo vive en el módulo `src/modules/events/`, salvo el chrome de sitio (`SiteNavbar`, `SiteTopbar`) en `src/components/layout/`, que recibe todo por props y no conoce el dominio. Un único `categories.ts` es la fuente de etiquetas, íconos y colores por categoría. `EventsLandingPage` es el único dueño del estado de filtros. La lógica pura (`filterEvents`, `sortEventsByDate`, `getPriceBounds`, `getEventDateParts`) se testea sin React.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui (base-nova sobre `@base-ui/react`), Swiper, react-day-picker, Vitest + RTL.

**Spec:** `docs/specs/landing-redesign/spec.md` (APROBADO). Leerlo antes de cada tarea; los criterios se citan como CR-n.

## Global Constraints

- Estructura, naming y reglas de `docs/SETUP.md` y `CLAUDE.md`: componentes `PascalCase.tsx`, utilidades `camelCase.ts`, tests colocados `<file>.test.ts(x)`, nombres de código en inglés y textos de UI en español.
- Solo modo claro. No agregar clases `dark:` ni tocar `globals.css`.
- Etiquetas, íconos y colores de categoría: **solo** desde `src/modules/events/categories.ts` (`CATEGORY_META`), sin mapas duplicados (CR-23).
- Nunca correr `npm install` ni `shadcn init` desde Claude Code. Solo `npx shadcn@latest add calendar`, y después de CR-1.
- Fechas del mock entre `2026-10-01` y `2027-03-31` (CR-22).
- Autoplay del hero: `delay: 6000`, `pauseOnMouseEnter: true`, `disableOnInteraction: false` (CR-4).
- Degradado del hero, verbatim (CR-5): `bg-gradient-to-t from-black/85 via-black/50 to-black/10 md:bg-gradient-to-r md:from-black/85 md:via-black/55 md:to-transparent`.
- Alto del hero y de su skeleton: `h-[440px] md:h-[520px]`, `rounded-3xl` (CR-7).
- Placeholder del buscador, verbatim: `Buscar eventos, artistas, lugares…`.
- No se hacen commits salvo que el usuario lo pida. Cada tarea termina con verificación, no con commit.

## Review Focus

1. **Precio sin rango posible** (`priceBounds.min === priceBounds.max`, p. ej. lista vacía → `{0,0}`): el botón "Precio" debe quedar deshabilitado, no abrir un slider inútil. Test en Task 6.
2. **Rango de fechas con solo `from`**: la etiqueta muestra un solo día y el filtro no restringe el final. Test en Task 6 (etiqueta); la lógica ya está cubierta por los tests de 2a.
3. **Filtros sin resultados**: mensaje vacío y conteo "0 eventos" en lugar de un grid vacío. Test en Task 7.
4. **Evento con fecha inválida**: la tarjeta omite el bloque de fecha en lugar de mostrar "NaN". Test en Task 4.
5. **Un solo evento destacado**: sin `loop` ni autoplay (Swiper avisa con `loop` y 1 slide). Se verifica leyendo el código en Task 5; es una condición explícita (`hasMultipleSlides`).

Verificación manual (no automatizable en jsdom), en Task 7: a 360 px de ancho no hay scroll horizontal de página y el texto del hero se lee en todas las slides.

---

## Orden y paralelismo

| Paso | Tareas | Quién | Paralelo |
| --- | --- | --- | --- |
| 0 | Task 0 (prerrequisitos + `categories.ts`) | orquestador | serial, zona compartida |
| A | Task 1, 2, 3, 5 | developers | sí, archivos disjuntos |
| B | Task 4, 6 | developers | sí; dependen de Task 1 (`getEventDateParts`) |
| C | Task 7 (integración) | orquestador | serial |
| D | reviewer → `review.md` | reviewer | — |

---

### Task 0: Prerrequisitos y fuente única de categorías (orquestador)

**Files:**
- Verify: `package.json`
- Create: `src/components/ui/calendar.tsx` (vía shadcn CLI)
- Create: `src/modules/events/categories.ts`

**Interfaces:**
- Produces: `CATEGORY_META: Record<EventCategory, CategoryMeta>` y `interface CategoryMeta { label: string; filterLabel: string; icon: LucideIcon; toneClassName: string }` desde `src/modules/events/categories.ts`. `Calendar` desde `@/components/ui/calendar` (props de `DayPicker`).

- [ ] **Step 1: Verificar CR-1**

Run: `grep -E '"(swiper|react-day-picker|date-fns)"' package.json`
Expected: tres líneas. Si falta alguna, **detenerse** y pedir al usuario que corra en su terminal: `npm install swiper react-day-picker date-fns`.

- [ ] **Step 2: Instalar calendar (CR-2)**

Run: `npx shadcn@latest add calendar`
Expected: crea `src/components/ui/calendar.tsx` sin fase "Installing dependencies" fallida. Confirmar que exporta `Calendar`: `grep -n "export" src/components/ui/calendar.tsx`.

- [ ] **Step 3: Crear `src/modules/events/categories.ts`**

```ts
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
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: sin errores.

---

### Task 1: `getEventDateParts` (CR-20)

**Files:**
- Modify: `src/lib/formatEventDate.ts`
- Test: `src/lib/formatEventDate.test.ts`

**Interfaces:**
- Produces: `getEventDateParts(isoDate: string): { day: string; month: string } | null`. Día sin cero inicial ("1", "24"); mes corto `es-ES` en mayúsculas y sin punto ("DIC", "MAR"); zona UTC. Acepta también `YYYY-MM-DD` (se interpreta como medianoche UTC). La consumen Task 4 y Task 6.

- [ ] **Step 1: Escribir los tests que fallan** (agregar al final de `formatEventDate.test.ts` y extender el import)

```ts
import { formatEventDate, getEventDateParts } from "./formatEventDate";

describe("getEventDateParts", () => {
  it("returns the UTC day and an uppercase short Spanish month", () => {
    expect(getEventDateParts("2026-12-24T12:00:00.000Z")).toEqual({
      day: "24",
      month: "DIC",
    });
  });

  it("uses UTC so late-night events do not shift to the next day", () => {
    expect(getEventDateParts("2026-03-01T02:00:00.000Z")).toEqual({
      day: "1",
      month: "MAR",
    });
  });

  it("accepts a plain YYYY-MM-DD calendar day", () => {
    expect(getEventDateParts("2026-10-14")).toEqual({ day: "14", month: "OCT" });
  });

  it("returns null for an invalid date", () => {
    expect(getEventDateParts("not-a-date")).toBeNull();
  });
});
```

(Reemplazar la línea de import existente `import { formatEventDate } from "./formatEventDate";` por la de arriba.)

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/lib/formatEventDate.test.ts`
Expected: FAIL, `getEventDateParts is not a function` / export inexistente.

- [ ] **Step 3: Implementar** (agregar a `src/lib/formatEventDate.ts`)

```ts
const DAY_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  timeZone: "UTC",
});

/**
 * Splits a date into the pieces shown in a calendar-style date badge
 * (e.g. `{ day: "14", month: "MAR" }`). Returns `null` for invalid input
 * so callers can simply omit the badge.
 */
export function getEventDateParts(
  isoDate: string
): { day: string; month: string } | null {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    day: DAY_FORMATTER.format(date),
    month: MONTH_FORMATTER.format(date).replace(".", "").toUpperCase(),
  };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/lib/formatEventDate.test.ts`
Expected: PASS (7 tests).

---

### Task 2: `sortEventsByDate` (CR-17)

**Files:**
- Modify: `src/modules/events/hooks/useEventFilters.ts`
- Test: `src/modules/events/hooks/useEventFilters.test.ts`

**Interfaces:**
- Consumes: `Event` de `../types`.
- Produces: `sortEventsByDate(events: Event[]): Event[]`: copia ordenada por `date` ascendente, sin mutar la entrada. La consume Task 7.

- [ ] **Step 1: Escribir los tests que fallan** (agregar al final de `useEventFilters.test.ts`; sumar `sortEventsByDate` al import existente de `./useEventFilters`)

```ts
describe("sortEventsByDate", () => {
  const base = {
    category: "concert",
    venue: "Venue",
    city: "Lima",
    price: 10,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1",
    featured: false,
  } as const;

  const late = { ...base, id: "late", title: "Late", date: "2027-01-10T20:00:00.000Z" };
  const early = { ...base, id: "early", title: "Early", date: "2026-10-05T20:00:00.000Z" };
  const middle = { ...base, id: "middle", title: "Middle", date: "2026-12-01T09:00:00.000Z" };

  it("orders events by date ascending", () => {
    const sorted = sortEventsByDate([late, early, middle]);

    expect(sorted.map((event) => event.id)).toEqual(["early", "middle", "late"]);
  });

  it("does not mutate the input array", () => {
    const input = [late, early, middle];

    sortEventsByDate(input);

    expect(input.map((event) => event.id)).toEqual(["late", "early", "middle"]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/modules/events/hooks/useEventFilters.test.ts`
Expected: FAIL, `sortEventsByDate` no exportado.

- [ ] **Step 3: Implementar** (en `useEventFilters.ts`, después de `getPriceBounds`)

```ts
/**
 * Returns a copy of `events` ordered by `date` ascending (soonest first).
 * ISO 8601 UTC strings sort correctly as plain strings. Never mutates the
 * input, so it is safe to call on memoized arrays.
 */
export function sortEventsByDate(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/modules/events/hooks/useEventFilters.test.ts`
Expected: PASS.

---

### Task 3: Fechas futuras en el mock (CR-22)

**Files:**
- Modify: `src/modules/events/services/eventsService.ts`
- Test: `src/modules/events/services/eventsService.test.ts`

**Interfaces:** sin cambios de contrato (`getEvents(): Promise<Event[]>`).

- [ ] **Step 1: Escribir el test que falla** (agregar dentro del `describe("getEvents")`)

```ts
  it("schedules every event between 2026-10-01 and 2027-03-31", async () => {
    const events = await getEvents();

    for (const event of events) {
      expect(event.date >= "2026-10-01").toBe(true);
      expect(event.date < "2027-04-01").toBe(true);
    }
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/modules/events/services/eventsService.test.ts`
Expected: FAIL (las fechas actuales son de 2026-01 a 2026-09).

- [ ] **Step 3: Reemplazar las 16 fechas** (cada valor viejo es único en el archivo; usar Edit o este `sed`)

```bash
sed -i \
  -e 's/2026-03-14T20:00:00.000Z/2026-11-14T20:00:00.000Z/' \
  -e 's/2026-04-02T19:30:00.000Z/2026-10-09T19:30:00.000Z/' \
  -e 's/2026-05-20T21:00:00.000Z/2027-01-22T21:00:00.000Z/' \
  -e 's/2026-03-28T19:00:00.000Z/2026-10-24T19:00:00.000Z/' \
  -e 's/2026-06-10T20:00:00.000Z/2026-12-05T20:00:00.000Z/' \
  -e 's/2026-04-18T18:00:00.000Z/2026-11-07T18:00:00.000Z/' \
  -e 's/2026-09-06T07:00:00.000Z/2027-02-14T07:00:00.000Z/' \
  -e 's/2026-01-24T16:00:00.000Z/2026-10-31T16:00:00.000Z/' \
  -e 's/2026-08-15T14:00:00.000Z/2027-03-13T14:00:00.000Z/' \
  -e 's/2026-05-05T09:00:00.000Z/2026-11-19T09:00:00.000Z/' \
  -e 's/2026-07-22T09:00:00.000Z/2027-02-25T09:00:00.000Z/' \
  -e 's/2026-04-11T10:00:00.000Z/2026-10-17T10:00:00.000Z/' \
  -e 's/2026-06-30T10:00:00.000Z/2026-12-12T10:00:00.000Z/' \
  -e 's/2026-03-21T15:00:00.000Z/2026-12-19T15:00:00.000Z/' \
  -e 's/2026-05-09T21:00:00.000Z/2026-11-27T21:00:00.000Z/' \
  -e 's/2026-06-19T18:30:00.000Z/2027-01-09T18:30:00.000Z/' \
  src/modules/events/services/eventsService.ts
```

Luego: `grep -n 'date:' src/modules/events/services/eventsService.ts` → 16 líneas, todas entre 2026-10 y 2027-03.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/modules/events/services/eventsService.test.ts`
Expected: PASS (5 tests).

---

### Task 4: Tarjeta de evento rediseñada + skeleton + grid de 4 columnas (CR-18, CR-19, CR-21)

**Depende de:** Task 0 (`CATEGORY_META`), Task 1 (`getEventDateParts`).

**Files:**
- Modify: `src/modules/events/components/EventCard.tsx`
- Modify: `src/modules/events/components/EventCardSkeleton.tsx`
- Modify: `src/modules/events/components/EventsGrid.tsx`
- Test: `src/modules/events/components/EventCard.test.tsx`

**Interfaces:**
- Consumes: `CATEGORY_META` (`../categories`), `getEventDateParts` (`@/lib/formatEventDate`), `formatCurrency` (`@/lib/formatCurrency`).
- Produces: `EventCard({ event }: { event: Event })` (misma firma). El bloque de fecha lleva `data-testid="event-date-badge"`. `CATEGORY_LABELS` deja de existir en `EventCard.tsx`.

- [ ] **Step 1: Reescribir los tests** (reemplazar el test "renders the formatted date…" y agregar los nuevos; el resto de `EventCard.test.tsx` queda igual)

```tsx
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
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/modules/events/components/EventCard.test.tsx`
Expected: FAIL (no existe `event-date-badge` ni "Desde").

- [ ] **Step 3: Reescribir `EventCard.tsx`**

```tsx
import Image from "next/image";
import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatCurrency";
import { getEventDateParts } from "@/lib/formatEventDate";

import { CATEGORY_META } from "../categories";
import type { Event } from "../types";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const dateParts = getEventDateParts(event.date);

  return (
    <Card className="group h-full gap-3 rounded-2xl pt-0 transition-shadow hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={event.imageUrl}
          alt={event.title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {dateParts && (
          <div
            data-testid="event-date-badge"
            className="absolute top-3 left-3 flex min-w-12 flex-col items-center rounded-xl bg-white px-2 py-1.5 leading-none text-foreground shadow-md"
          >
            <span className="text-xl font-bold">{dateParts.day}</span>
            <span className="mt-0.5 text-[0.65rem] font-semibold tracking-wide text-primary">
              {dateParts.month}
            </span>
          </div>
        )}
      </div>
      <CardHeader className="gap-2">
        <Badge variant="secondary" className="w-fit">
          {CATEGORY_META[event.category].label}
        </Badge>
        <CardTitle className="line-clamp-2 text-base font-semibold">
          {event.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-2">
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {event.venue}, {event.city}
        </p>
        <p className="text-sm text-muted-foreground">
          Desde{" "}
          <span className="text-base font-semibold text-foreground">
            {formatCurrency(event.price, event.currency)}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Reescribir `EventCardSkeleton.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder matching EventCard's layout. Purely visual, no
 * conditional logic, so it does not have a dedicated test (see spec).
 */
export function EventCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2 px-4 pb-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `EventsGrid.tsx` a 4 columnas**

En `EventsGrid.tsx`: `SKELETON_COUNT = 8` y **en las dos** apariciones reemplazar `lg:grid-cols-3` por `lg:grid-cols-4` (resultado: `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4`).

- [ ] **Step 6: Correr y ver que pasa**

Run: `npx vitest run src/modules/events/components/EventCard.test.tsx src/modules/events/components/EventsGrid.test.tsx && npm run typecheck`
Expected: PASS; typecheck sin errores (`grep -rn CATEGORY_LABELS src` → sin resultados).

---

### Task 5: Categorías en fila de íconos + hero en carrusel (CR-3 a CR-6, CR-14 a CR-16)

Son dos archivos independientes asignados a un mismo developer porque ambos consumen `CATEGORY_META` y ninguno lo toca otra tarea. Si se prefiere, se pueden dividir en 5a/5b paralelas.

**Depende de:** Task 0.

**Files:**
- Modify: `src/modules/events/components/CategoryFilter.tsx`
- Test: `src/modules/events/components/CategoryFilter.test.tsx`
- Create: `src/modules/events/components/FeaturedEventsHero.tsx`

**Interfaces:**
- Consumes: `CATEGORY_META`, `CategoryMeta` (`../categories`).
- Produces: `CategoryFilter({ value, onValueChange })` y `type CategoryFilterValue = EventCategory | "all"` (mismo contrato). `FeaturedEventsHero({ events }: { events: Event[] })`: renderiza una slide por cada evento recibido (no filtra; el caller le pasa solo destacados).

- [ ] **Step 1: Test nuevo de CategoryFilter** (agregar al `describe`; los 3 tests existentes siguen válidos sin cambios)

```tsx
  it("highlights the active category's icon bubble with a primary ring", () => {
    render(<CategoryFilter value="sports" onValueChange={vi.fn()} />);

    const bubble = screen
      .getByRole("button", { name: "Deportes" })
      .querySelector("[data-slot='category-icon']");
    expect(bubble).toHaveClass("ring-primary");
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/modules/events/components/CategoryFilter.test.tsx`
Expected: FAIL (no existe `data-slot='category-icon'`).

- [ ] **Step 3: Reescribir `CategoryFilter.tsx`**

```tsx
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
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/modules/events/components/CategoryFilter.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Crear `FeaturedEventsHero.tsx`** (sin test dedicado, ver spec. Se ejercita con Swiper mockeado en el test de la página, Task 7)

```tsx
"use client";

import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { A11y, Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatEventDate } from "@/lib/formatEventDate";

import { CATEGORY_META } from "../categories";
import type { Event } from "../types";

interface FeaturedEventsHeroProps {
  events: Event[];
}

/**
 * Full-width featured events carousel. A fixed dark gradient sits between
 * the photo and the copy, so the white text stays readable regardless of
 * how bright each image is (bottom-weighted on mobile, left-weighted on
 * desktop). Loop/autoplay only kick in with 2+ slides.
 */
export function FeaturedEventsHero({ events }: FeaturedEventsHeroProps) {
  const hasMultipleSlides = events.length > 1;

  return (
    <Swiper
      modules={[A11y, Autoplay, Navigation, Pagination]}
      loop={hasMultipleSlides}
      autoplay={
        hasMultipleSlides
          ? { delay: 6000, pauseOnMouseEnter: true, disableOnInteraction: false }
          : false
      }
      pagination={{ clickable: true }}
      navigation
      a11y={{
        prevSlideMessage: "Evento anterior",
        nextSlideMessage: "Evento siguiente",
        paginationBulletMessage: "Ir al evento {{index}}",
      }}
      className="h-[440px] w-full overflow-hidden rounded-3xl md:h-[520px] [--swiper-navigation-color:#fff] [--swiper-navigation-size:28px] [--swiper-pagination-bullet-inactive-color:#fff] [--swiper-pagination-bullet-inactive-opacity:0.5] [--swiper-pagination-color:#fff] [&_.swiper-button-next]:hidden [&_.swiper-button-prev]:hidden md:[&_.swiper-button-next]:flex md:[&_.swiper-button-prev]:flex"
    >
      {events.map((event, index) => (
        <SwiperSlide key={event.id} className="relative">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            priority={index === 0}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/10 md:bg-gradient-to-r md:from-black/85 md:via-black/55 md:to-transparent"
          />
          <div className="relative flex h-full max-w-2xl flex-col justify-end gap-4 p-6 pb-12 text-white md:justify-center md:p-12">
            <Badge className="w-fit bg-highlight text-highlight-foreground">
              {CATEGORY_META[event.category].label}
            </Badge>
            <h2 className="text-3xl leading-tight font-bold text-balance md:text-5xl">
              {event.title}
            </h2>
            <div className="flex flex-col gap-1.5 text-sm text-white/90 md:text-base">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                {formatEventDate(event.date)}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {event.venue}, {event.city}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                nativeButton={false}
                render={<a href="#" />}
                className="h-11 px-6 text-base"
              >
                Comprar entradas
              </Button>
              <p className="text-sm text-white/90">
                Desde{" "}
                <span className="text-lg font-semibold text-white">
                  {formatCurrency(event.price, event.currency)}
                </span>
              </p>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
```

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. Si `swiper/css` da error de tipos por módulo CSS, confirmar que `next-env.d.ts` está incluido en `tsconfig.json` (Next ya declara `*.css`).

---

### Task 6: `SiteTopbar` con búsqueda, fecha y precio (CR-10 a CR-13)

**Depende de:** Task 0 (`Calendar`), Task 1 (`getEventDateParts`).

**Files:**
- Create: `src/components/layout/SiteTopbar.tsx`
- Test: `src/components/layout/SiteTopbar.test.tsx`

**Interfaces:**
- Consumes: `Calendar` (`@/components/ui/calendar`), `Popover*`, `Slider`, `Button`, `Input`, `formatCurrency`, `getEventDateParts`.
- Produces:
  ```ts
  export interface DateRangeValue { from: string | null; to: string | null } // YYYY-MM-DD
  export interface PriceRangeValue { min: number | null; max: number | null }
  export interface SiteTopbarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    dateRange: DateRangeValue;
    onDateRangeChange: (value: DateRangeValue) => void;
    priceRange: PriceRangeValue;
    onPriceRangeChange: (value: PriceRangeValue) => void;
    priceBounds: { min: number; max: number };
    currency: string; // ISO 4217
  }
  ```
  Son estructuralmente idénticos a `DateRangeFilter`/`PriceRangeFilter` de `useEventFilters.ts`, así que Task 7 pasa el estado directo. No se importan tipos de `modules/events`, porque el layout no conoce el dominio.

- [ ] **Step 1: Escribir los tests que fallan** (`src/components/layout/SiteTopbar.test.tsx`)

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formatCurrency } from "@/lib/formatCurrency";

import { SiteTopbar, type SiteTopbarProps } from "./SiteTopbar";

function renderTopbar(overrides: Partial<SiteTopbarProps> = {}) {
  const props: SiteTopbarProps = {
    searchValue: "",
    onSearchChange: vi.fn(),
    dateRange: { from: null, to: null },
    onDateRangeChange: vi.fn(),
    priceRange: { min: null, max: null },
    onPriceRangeChange: vi.fn(),
    priceBounds: { min: 20, max: 150 },
    currency: "USD",
    ...overrides,
  };

  return { props, ...render(<SiteTopbar {...props} />) };
}

describe("SiteTopbar", () => {
  it("is sticky at the top of the viewport", () => {
    const { container } = renderTopbar();

    expect(container.firstChild).toHaveClass("sticky", "top-0");
  });

  it("renders a single search input that reports typed text", async () => {
    const user = userEvent.setup();
    const { props } = renderTopbar();

    const inputs = screen.getAllByPlaceholderText(
      "Buscar eventos, artistas, lugares…"
    );
    expect(inputs).toHaveLength(1);

    await user.type(inputs[0], "a");

    expect(props.onSearchChange).toHaveBeenCalledWith("a");
  });

  it("shows 'Fecha' and 'Precio' placeholders when no range is set", () => {
    renderTopbar();

    expect(screen.getByRole("button", { name: /Fecha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Precio/ })).toBeInTheDocument();
  });

  it("labels a full date range and a from-only range", () => {
    const { unmount } = renderTopbar({
      dateRange: { from: "2026-10-14", to: "2026-10-20" },
    });
    expect(
      screen.getByRole("button", { name: /14 oct – 20 oct/ })
    ).toBeInTheDocument();
    unmount();

    renderTopbar({ dateRange: { from: "2026-10-14", to: null } });
    expect(screen.getByRole("button", { name: /14 oct/ })).toBeInTheDocument();
  });

  it("opens a calendar and reports the picked day as YYYY-MM-DD", async () => {
    const user = userEvent.setup();
    const { props } = renderTopbar({
      dateRange: { from: "2026-10-14", to: null },
    });

    await user.click(screen.getByRole("button", { name: /14 oct/ }));
    const grid = await screen.findByRole("grid");
    await user.click(within(grid).getByText("20"));

    expect(props.onDateRangeChange).toHaveBeenCalledWith({
      from: "2026-10-14",
      to: "2026-10-20",
    });
  });

  it("clears the date range", async () => {
    const user = userEvent.setup();
    const { props } = renderTopbar({
      dateRange: { from: "2026-10-14", to: "2026-10-20" },
    });

    await user.click(screen.getByRole("button", { name: /14 oct/ }));
    await user.click(await screen.findByRole("button", { name: /Limpiar fechas/ }));

    expect(props.onDateRangeChange).toHaveBeenCalledWith({ from: null, to: null });
  });

  it("labels the price trigger with the formatted selected range", () => {
    renderTopbar({ priceRange: { min: 40, max: 100 } });

    const label = `${formatCurrency(40, "USD")} – ${formatCurrency(100, "USD")}`;
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });

  it("disables the price filter when there is no price range to pick", () => {
    renderTopbar({ priceBounds: { min: 0, max: 0 } });

    expect(screen.getByRole("button", { name: /Precio/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/components/layout/SiteTopbar.test.tsx`
Expected: FAIL (el módulo `./SiteTopbar` no existe).

- [ ] **Step 3: Implementar `src/components/layout/SiteTopbar.tsx`**

```tsx
"use client";

import { CalendarDays, Search, SlidersHorizontal, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/formatCurrency";
import { getEventDateParts } from "@/lib/formatEventDate";

/** Inclusive calendar-day range, `YYYY-MM-DD` (no time). */
export interface DateRangeValue {
  from: string | null;
  to: string | null;
}

export interface PriceRangeValue {
  min: number | null;
  max: number | null;
}

export interface SiteTopbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (value: DateRangeValue) => void;
  priceRange: PriceRangeValue;
  onPriceRangeChange: (value: PriceRangeValue) => void;
  priceBounds: { min: number; max: number };
  /** ISO 4217 code used to format prices, e.g. "USD". */
  currency: string;
}

const EMPTY_DATE_RANGE: DateRangeValue = { from: null, to: null };
const EMPTY_PRICE_RANGE: PriceRangeValue = { min: null, max: null };

/** Calendar `Date` (local midnight) → `YYYY-MM-DD`. */
function toCalendarDay(date: Date | undefined): string | null {
  if (!date) {
    return null;
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM-DD` → local-midnight `Date` for the calendar. */
function fromCalendarDay(day: string | null): Date | undefined {
  if (!day) {
    return undefined;
  }

  const [year, month, date] = day.split("-").map(Number);

  return new Date(year, month - 1, date);
}

/** `YYYY-MM-DD` → "14 oct". */
function formatCalendarDay(day: string): string {
  const parts = getEventDateParts(day);

  return parts ? `${parts.day} ${parts.month.toLowerCase()}` : day;
}

function getDateLabel({ from, to }: DateRangeValue): string {
  if (!from) {
    return "Fecha";
  }

  if (!to || to === from) {
    return formatCalendarDay(from);
  }

  return `${formatCalendarDay(from)} – ${formatCalendarDay(to)}`;
}

/**
 * Sticky filter bar: text search + date range + price range. Generic site
 * chrome with no knowledge of the "event" domain — fully controlled via
 * props, the caller owns every piece of filter state.
 */
export function SiteTopbar({
  searchValue,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  priceRange,
  onPriceRangeChange,
  priceBounds,
  currency,
}: SiteTopbarProps) {
  const hasDateRange = dateRange.from !== null;
  const hasPriceRange = priceRange.min !== null || priceRange.max !== null;
  const canFilterByPrice = priceBounds.min < priceBounds.max;
  const sliderValue = [
    priceRange.min ?? priceBounds.min,
    priceRange.max ?? priceBounds.max,
  ];
  const priceLabel = hasPriceRange
    ? `${formatCurrency(sliderValue[0], currency)} – ${formatCurrency(sliderValue[1], currency)}`
    : "Precio";

  return (
    <div className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center lg:px-6">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar eventos, artistas, lugares…"
            aria-label="Buscar eventos, artistas, lugares"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 rounded-full pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className="h-10 flex-1 rounded-full md:flex-none"
                />
              }
            >
              <CalendarDays aria-hidden="true" />
              {getDateLabel(dateRange)}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto">
              <Calendar
                mode="range"
                locale={es}
                defaultMonth={fromCalendarDay(dateRange.from)}
                selected={
                  hasDateRange
                    ? {
                        from: fromCalendarDay(dateRange.from),
                        to: fromCalendarDay(dateRange.to),
                      }
                    : undefined
                }
                onSelect={(range: DateRange | undefined) =>
                  onDateRangeChange({
                    from: toCalendarDay(range?.from),
                    to: toCalendarDay(range?.to),
                  })
                }
              />
              {hasDateRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDateRangeChange(EMPTY_DATE_RANGE)}
                >
                  <X aria-hidden="true" />
                  Limpiar fechas
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger
              disabled={!canFilterByPrice}
              render={
                <Button
                  variant="outline"
                  className="h-10 flex-1 rounded-full md:flex-none"
                />
              }
            >
              <SlidersHorizontal aria-hidden="true" />
              {priceLabel}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 gap-4 p-4">
              <p className="text-sm font-medium">Rango de precio</p>
              <Slider
                aria-label="Rango de precio"
                min={priceBounds.min}
                max={priceBounds.max}
                value={sliderValue}
                onValueChange={(value) => {
                  if (typeof value === "number") {
                    return;
                  }
                  onPriceRangeChange({ min: value[0], max: value[1] });
                }}
              />
              <p className="flex justify-between text-sm text-muted-foreground">
                <span>{formatCurrency(sliderValue[0], currency)}</span>
                <span>{formatCurrency(sliderValue[1], currency)}</span>
              </p>
              {hasPriceRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPriceRangeChange(EMPTY_PRICE_RANGE)}
                >
                  <X aria-hidden="true" />
                  Limpiar precio
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
```

Notas para el implementador:
- Si la versión instalada de `react-day-picker` no exporta `react-day-picker/locale`, usar `import { es } from "date-fns/locale"` (ya instalado por CR-1).
- Si el `Calendar` generado por shadcn ya envuelve `DayPicker` con `showOutsideDays`, el texto "20" puede aparecer dos veces en la grilla. En ese caso el test debe elegir el botón del mes actual: `within(grid).getAllByText("20")[0]`, y verificar que la fecha reportada sea `2026-10-20`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/components/layout/SiteTopbar.test.tsx && npm run typecheck`
Expected: PASS (8 tests); typecheck limpio.

---

### Task 7: Integración de la página (orquestador) (CR-3, CR-7, CR-8, CR-16 a CR-18, CR-24)

**Depende de:** Tasks 0–6.

**Files:**
- Modify: `src/modules/events/components/EventsLandingPage.tsx`
- Test: `src/modules/events/components/EventsLandingPage.test.tsx`
- Delete: `src/components/layout/SiteHeader.tsx`, `src/components/layout/SiteHeader.test.tsx`

**Interfaces:**
- Consumes: `SiteNavbar`, `SiteTopbar` (+ `SiteTopbarProps`), `FeaturedEventsHero`, `CategoryFilter`, `EventsGrid`, `useEvents`, `useEventFilters`, `sortEventsByDate`, `getPriceBounds`, `DateRangeFilter`, `PriceRangeFilter`.

- [ ] **Step 1: Reescribir el test de la página** (`EventsLandingPage.test.tsx` completo)

```tsx
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Event } from "../types";
import { EventsLandingPage } from "./EventsLandingPage";

const mockEvents: Event[] = [
  {
    id: "1",
    title: "Neon Skyline Tour",
    category: "concert",
    date: "2026-11-14T20:00:00.000Z",
    venue: "Estadio Nacional",
    city: "Lima",
    price: 85,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1668934804631-e8337c891e65",
    featured: true,
  },
  {
    id: "2",
    title: "Noche de Teatro Clásico",
    category: "theater",
    date: "2026-10-10T19:00:00.000Z",
    venue: "Gran Teatro Nacional",
    city: "Lima",
    price: 40,
    currency: "USD",
    imageUrl: "https://images.unsplash.com/photo-1651437524278-b37b83a6e6d3",
    featured: false,
  },
];

vi.mock("@/modules/events/services/eventsService", () => ({
  getEvents: vi.fn(() => Promise.resolve(mockEvents)),
}));

// jsdom has no ResizeObserver, which Swiper needs: render slides as plain divs.
vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("swiper/modules", () => ({
  A11y: {},
  Autoplay: {},
  Navigation: {},
  Pagination: {},
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EventsLandingPage />
    </QueryClientProvider>
  );
}

async function waitForGrid() {
  const gridSection = screen.getByTestId("events-grid-section");
  await waitFor(() => {
    expect(
      within(gridSection).getByText("Noche de Teatro Clásico")
    ).toBeInTheDocument();
  });
  return gridSection;
}

describe("EventsLandingPage", () => {
  it("shows only featured events in the hero", async () => {
    renderPage();
    await waitForGrid();

    const hero = screen.getByTestId("featured-events-section");
    expect(within(hero).getByText("Neon Skyline Tour")).toBeInTheDocument();
    expect(
      within(hero).queryByText("Noche de Teatro Clásico")
    ).not.toBeInTheDocument();
  });

  it("lists upcoming events sorted by date with a result count", async () => {
    renderPage();
    const gridSection = await waitForGrid();

    const text = gridSection.textContent ?? "";
    expect(text.indexOf("Noche de Teatro Clásico")).toBeLessThan(
      text.indexOf("Neon Skyline Tour")
    );
    expect(within(gridSection).getByText("2 eventos")).toBeInTheDocument();
  });

  it("combines search and category filters with AND", async () => {
    const user = userEvent.setup();
    renderPage();
    const gridSection = await waitForGrid();

    await user.type(
      screen.getByPlaceholderText("Buscar eventos, artistas, lugares…"),
      "teatro"
    );

    expect(
      within(gridSection).queryByText("Neon Skyline Tour")
    ).not.toBeInTheDocument();
    expect(within(gridSection).getByText("1 evento")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Conciertos" }));

    expect(
      within(gridSection).getByText("No se encontraron eventos con esos filtros")
    ).toBeInTheDocument();
    expect(within(gridSection).getByText("0 eventos")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/modules/events/components/EventsLandingPage.test.tsx`
Expected: FAIL (no hay conteo, el hero sigue siendo grid y hay dos inputs de búsqueda).

- [ ] **Step 3: Reescribir `EventsLandingPage.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";

import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { SiteTopbar } from "@/components/layout/SiteTopbar";
import { Skeleton } from "@/components/ui/skeleton";

import {
  getPriceBounds,
  sortEventsByDate,
  useEventFilters,
  type DateRangeFilter,
  type PriceRangeFilter,
} from "../hooks/useEventFilters";
import { useEvents } from "../hooks/useEvents";
import type { Event } from "../types";
import { CategoryFilter, type CategoryFilterValue } from "./CategoryFilter";
import { EventsGrid } from "./EventsGrid";
import { FeaturedEventsHero } from "./FeaturedEventsHero";

const EMPTY_EVENTS: Event[] = [];
const EMPTY_DATE_RANGE: DateRangeFilter = { from: null, to: null };
const EMPTY_PRICE_RANGE: PriceRangeFilter = { min: null, max: null };
const DEFAULT_CURRENCY = "USD";

/**
 * Composes the events landing page and owns every piece of filter state
 * (search, category, date, price). Featured events feed the hero and are
 * intentionally independent of the filters; the "Próximos eventos" grid
 * shows the filtered events, soonest first.
 */
export function EventsLandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilterValue>("all");
  const [dateRange, setDateRange] = useState(EMPTY_DATE_RANGE);
  const [priceRange, setPriceRange] = useState(EMPTY_PRICE_RANGE);

  const { data, isLoading } = useEvents();
  const events = data ?? EMPTY_EVENTS;

  const filteredEvents = useEventFilters(events, {
    searchQuery,
    category,
    dateRange,
    priceRange,
  });
  const upcomingEvents = useMemo(
    () => sortEventsByDate(filteredEvents),
    [filteredEvents]
  );
  const featuredEvents = useMemo(
    () => events.filter((event) => event.featured),
    [events]
  );
  const priceBounds = useMemo(() => getPriceBounds(events), [events]);
  const currency = events[0]?.currency ?? DEFAULT_CURRENCY;

  return (
    <>
      <SiteNavbar />
      <SiteTopbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        priceBounds={priceBounds}
        currency={currency}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-8 lg:px-6">
        {isLoading ? (
          <Skeleton className="h-[440px] w-full rounded-3xl md:h-[520px]" />
        ) : (
          featuredEvents.length > 0 && (
            <section
              data-testid="featured-events-section"
              aria-label="Eventos destacados"
            >
              <FeaturedEventsHero events={featuredEvents} />
            </section>
          )
        )}

        <section
          data-testid="categories-section"
          className="flex flex-col gap-4"
        >
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Explora por categoría
          </h2>
          <CategoryFilter value={category} onValueChange={setCategory} />
        </section>

        <section
          data-testid="events-grid-section"
          className="flex flex-col gap-6"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Próximos eventos
            </h2>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                {upcomingEvents.length}{" "}
                {upcomingEvents.length === 1 ? "evento" : "eventos"}
              </p>
            )}
          </div>
          <EventsGrid events={upcomingEvents} isLoading={isLoading} />
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Eliminar `SiteHeader`**

Run: `rm src/components/layout/SiteHeader.tsx src/components/layout/SiteHeader.test.tsx && grep -rn "SiteHeader" src`
Expected: el grep no devuelve nada.

- [ ] **Step 5: Correr el test de la página**

Run: `npx vitest run src/modules/events/components/EventsLandingPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Verificación completa (CR-24)**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: todo en verde; `/` se prerenderiza.

- [ ] **Step 7: Verificación visual (Review Focus + legibilidad)**

Con `npm run dev`, abrir `http://localhost:3000` y revisar a 1280 px y a 360 px de ancho:
- (a) el texto de cada slide del hero se lee y el autoplay avanza;
- (b) no hay scroll horizontal de página a 360 px;
- (c) la fila de categorías scrollea y la activa tiene anillo;
- (d) el topbar queda pegado arriba al hacer scroll;
- (e) fecha y precio filtran el grid.

Anotar el resultado en `review.md`.

---

### Paso D: Review

Despachar `reviewer` con el spec `docs/specs/landing-redesign/spec.md` y este plan. El reviewer escribe `docs/specs/landing-redesign/review.md` con el veredicto APROBADO / CAMBIOS REQUERIDOS. Si pide cambios, se aplica el loop de corrección.
