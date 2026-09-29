# Plan — Landing page de eventos (mock data) + design system base

> Spec: `docs/specs/events-landing/spec.md` — Iteración 1 **APROBADO** e implementada. Iteración 2 **APROBADA** (Usuario, ronaldreyesramirez@gmail.com, 2026-09-25).

## Iteración 1 — COMPLETA (implementada y revisada)

Veredicto del `reviewer`: **APROBADO** (ver `docs/specs/events-landing/review.md`). 32 tests, lint/typecheck/build en verde. 2 hallazgos menores no bloqueantes.

### Preparación de zona compartida (orquestador, en serie, antes del lote paralelo)

- `src/app/layout.tsx` — Poppins (`next/font/google`) reemplaza a Geist Sans como `--font-sans`; `metadata.title`/`description` actualizados (CA-5, CA-19).
- `src/app/globals.css` — `:root.--primary`/`--ring` a violeta `oklch(0.541 0.281 293.009)`, tokens nuevos `--highlight`/`--highlight-foreground` (ámbar) mapeados en `@theme inline`; `--font-sans: var(--font-poppins)`. `.dark` sin tocar (CA-6).
- `next.config.ts` — `images.remotePatterns` para `images.unsplash.com` (CA-4).
- Instalados vía `npx shadcn@latest add`: `card`, `badge`, `input`, `separator`, `skeleton`, `sheet`, `tabs`. No se tocó `package.json`.
- `src/modules/events/types.ts` — `Event`, `EventCategory` (contrato base).
- `src/lib/formatEventDate.ts` (+ test) y `src/lib/formatCurrency.ts` (+ test).
- `src/modules/events/components/EventCardSkeleton.tsx` — sin test (puramente visual).
- `src/components/layout/SiteFooter.tsx` — sin test (estático).

**Diferido en su momento a "Iteración 2":** `FeaturedEventsCarousel.tsx` (shadcn `Carousel`/`embla-carousel-react`). **Esta decisión quedó sin efecto**: la Iteración 2 aprobada reemplaza ese plan por un hero con Swiper (ver más abajo).

### Tareas de developer (Grupo paralelo A — 6 agentes a la vez, todas `Depende de: —`, archivos disjuntos)

#### T1 — Servicio de eventos (mock data)
- **Criterios:** CA-2, CA-3 — **Archivos:** `src/modules/events/services/eventsService.ts`, `.test.ts`
- **Estado:** ✅ completado (13 eventos, 6 categorías, 4 featured)

#### T2 — Hooks de datos y filtrado
- **Criterios:** CA-11 — **Archivos:** `src/modules/events/hooks/useEventFilters.ts`, `.test.ts`, `useEvents.ts`
- **Estado:** ✅ completado

#### T3 — Tarjeta de evento
- **Criterios:** CA-14 — **Archivos:** `src/modules/events/components/EventCard.tsx`, `.test.tsx`
- **Estado:** ✅ completado

#### T4 — Filtro de categorías
- **Criterios:** CA-10 — **Archivos:** `src/modules/events/components/CategoryFilter.tsx`, `.test.tsx`
- **Estado:** ✅ completado (con `Tabs`, luego rediseñado en Iteración 2a — ver T9)

#### T5 — Grid de eventos
- **Criterios:** CA-12, CA-13, CA-18 — **Archivos:** `src/modules/events/components/EventsGrid.tsx`, `.test.tsx`
- **Estado:** ✅ completado

#### T6 — Header del sitio
- **Criterios:** CA-8, CA-18 — **Archivos:** `src/components/layout/SiteHeader.tsx`, `.test.tsx`
- **Estado:** ✅ completado (reemplazado en Iteración 2b por `SiteNavbar`+`SiteTopbar` — ver más abajo)

### Integración de Iteración 1 (orquestador)

`EventsLandingPage.tsx` (+test), barrel `src/modules/events/index.ts`, `src/app/page.tsx` reescrito y delgado. Verificación completa: `npm run lint && npm run build` — ambos en verde.

---

## Iteración 2 — dividida en 2a (sin dependencias externas) y 2b (bloqueada por instalaciones del usuario)

Al aprobar, se verificó `package.json`: `swiper`, `react-day-picker` y `date-fns` **no están instalados**. Para no bloquear todo el trabajo, se parte en dos.

### Iteración 2a — EN EJECUCIÓN AHORA (no depende de swiper/calendar)

Preparación de zona compartida (orquestador, antes del lote paralelo):
- `src/modules/events/types.ts` — `EventCategory` ampliado a 9 valores (`+family`, `+comedy`, `+cinema`). Ya aplicado.
- Instalados vía shadcn (sin prerrequisito): `popover`, `slider`. Ya aplicado.
- `src/components/layout/SiteNavbar.tsx` — creado por el orquestador (extracción trivial de logo+nav+menú mobile del `SiteHeader` actual, sin buscador, sin estado, sin test dedicado). Ya aplicado. **Aún no se wirea en `EventsLandingPage`** — `SiteHeader` sigue siendo el header activo hasta que `SiteTopbar` exista (Iteración 2b), para no romper el sitio funcionando.

Tareas de developer (Grupo paralelo A, un solo mensaje, 4 agentes a la vez, todas `Depende de: —`, archivos disjuntos):

#### T7 — Mock data ampliada a 9 categorías
- **Criterios que cubre:** CA-33 (vía types.ts ya hecho), CA-34
- **Archivos (propiedad exclusiva):** `src/modules/events/services/eventsService.ts`, `src/modules/events/services/eventsService.test.ts`
- **Depende de:** —
- **Grupo paralelo:** B
- **Verificación:** `npm run lint && npx tsc --noEmit && npx vitest run src/modules/events/services/eventsService.test.ts`

#### T8 — Filtros de fecha y precio (lógica pura)
- **Criterios que cubre:** CA-29, CA-30, CA-31, CA-32
- **Archivos (propiedad exclusiva):** `src/modules/events/hooks/useEventFilters.ts`, `src/modules/events/hooks/useEventFilters.test.ts`
- **Depende de:** —
- **Grupo paralelo:** B
- **Verificación:** `npm run lint && npx tsc --noEmit && npx vitest run src/modules/events/hooks/useEventFilters.test.ts`

#### T9 — CategoryFilter rediseñado (Card + ícono)
- **Criterios que cubre:** CA-35
- **Archivos (propiedad exclusiva):** `src/modules/events/components/CategoryFilter.tsx`, `src/modules/events/components/CategoryFilter.test.tsx`
- **Depende de:** —
- **Grupo paralelo:** B
- **Verificación:** `npm run lint && npx tsc --noEmit && npx vitest run src/modules/events/components/CategoryFilter.test.tsx`
- **Nota:** rompe la aserción `role="tab"` que usa hoy `EventsLandingPage.test.tsx`; el orquestador la corrige en integración (no es tarea de este developer, no toca ese archivo).

#### T10 — CATEGORY_LABELS de 9 categorías
- **Criterios que cubre:** CA-36
- **Archivos (propiedad exclusiva):** `src/modules/events/components/EventCard.tsx`, `src/modules/events/components/EventCard.test.tsx`
- **Depende de:** —
- **Grupo paralelo:** B
- **Verificación:** `npm run lint && npx tsc --noEmit && npx vitest run src/modules/events/components/EventCard.test.tsx`

### Integración de 2a — COMPLETA

1. ✅ Fix puntual de `src/modules/events/components/EventsLandingPage.test.tsx`: `getByRole("tab", ...)` reemplazado por `getByRole("button", { name: "Conciertos" })` (mecanismo de `CategoryFilter` v2: `aria-pressed`).
2. ✅ Verificación completa: `npm run lint` (limpio), `npx tsc --noEmit` (limpio), `npm test` (45 tests / 10 archivos, todos en verde), `npm run build` (compilado, `/` prerenderizada estática).
3. **`reviewer` sigue sin despacharse** — 2a es una porción incompleta de la Iteración 2 (falta el hero y el topbar). El review se hace una sola vez cuando 2b también esté lista.

Estado de `EventCategory`: 9 valores. `CategoryFilter`: `Card`+ícono (`aria-pressed`), ya no `Tabs`. `SiteNavbar.tsx` existe pero **aún no está wireado** en `EventsLandingPage` — el sitio en producción sigue usando `SiteHeader` (Iteración 1) hasta que `SiteTopbar` exista.

### Iteración 2b — REEMPLAZADA por `docs/specs/landing-redesign/spec.md` (2026-09-25); no se ejecuta desde este plan. Contenido original:
```
npm install swiper
npm install react-day-picker date-fns
```

Una vez confirmado, el orquestador:
1. Corre `npx shadcn@latest add calendar`.
2. Despacha developer(s) para `FeaturedEventsHero.tsx` (CA-21, CA-22) y `SiteTopbar.tsx` + test (CA-23 a CA-28), en paralelo (archivos disjuntos: uno en `src/modules/events/components/`, otro en `src/components/layout/`).
3. Integra: elimina `SiteHeader.tsx`/`SiteHeader.test.tsx`, actualiza `EventsLandingPage.tsx` (usa `SiteNavbar`+`SiteTopbar`+`FeaturedEventsHero`, estado `dateRange`/`priceRange`/`priceBounds` vía `getPriceBounds`), actualiza `EventsLandingPage.test.tsx` al input único de `SiteTopbar`.
4. Verificación completa + `npm run build`.
5. Despacha `reviewer` para toda la Iteración 2 (2a + 2b) de una vez.

## Próximas iteraciones (fuera de esta sesión, no pedidas aún)

- Página de detalle de evento, checkout, autenticación, dark mode toggle real, ordenamiento/paginación, guardar filtros en URL.
