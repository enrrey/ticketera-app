# Review — events-landing (ciclo 1)

## A0. Spec aprobado

`docs/specs/events-landing/spec.md:1-6` — cabecera dice `APROBADO`, aprobado por Usuario (ronaldreyesramirez@gmail.com), 2026-09-25. Gate humano cumplido. No es hallazgo.

## Veredicto
APROBADO

## Alcance de esta revisión

Se revisa únicamente la Iteración 1 (lo efectivamente implementado). `FeaturedEventsCarousel` real (CA-7 parcial: el carrusel de destacados; CA-9 completo) está explícitamente diferido a la Iteración 2 tanto en `spec.md:6` como en `plan.md:22,80`, por el prerrequisito real de `embla-carousel-react`. La sección de destacados usa hoy un grid plano (`EventsLandingPage.tsx:38-52`). Esto coincide con lo documentado, por lo que **no se marca como hallazgo**; se deja constancia en la tabla como PARCIAL/NO CUBIERTO justificado.

## Criterios de aceptación

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| CA-1 | CUMPLE | `src/app/page.tsx:1-11` importa solo `@/modules/events` (barrel) y `@/components/layout/SiteFooter`, sin JSX propio ni estado; `src/modules/events/{components,hooks,services,types.ts,index.ts}` existen |
| CA-2 | CUMPLE | `src/modules/events/services/eventsService.ts:5-189` — 13 eventos, ≥1 por cada `EventCategory`, 4 con `featured: true` (evt-001, evt-004, evt-006, evt-011); `getEvents()` retorna `Promise<Event[]>` vía `setTimeout` (líneas 183-189); verificado también por `eventsService.test.ts:16-47` |
| CA-3 | CUMPLE | Todos los `imageUrl` en `eventsService.ts` empiezan con `https://images.unsplash.com/`; test dedicado en `eventsService.test.ts:39-47` |
| CA-4 | CUMPLE | `next.config.ts:4-11` declara `images.remotePatterns` con `hostname: "images.unsplash.com"`; `EventCard.tsx:35-40` usa `next/image` |
| CA-5 | CUMPLE | `src/app/layout.tsx:2,7-11` importa `Poppins`; `globals.css:79` mapea `--font-sans: var(--font-poppins)`; Geist Sans ya no se importa (solo `Geist_Mono` para `--font-mono`, línea 13-16 de `layout.tsx`) |
| CA-6 | CUMPLE | `globals.css:15` `--primary: oklch(0.541 0.281 293.009)`, línea 26 `--ring` mismo tono, líneas 27-28 `--highlight`/`--highlight-foreground` nuevos; `git diff` confirma que el bloque `.dark` (líneas 44-76) no tiene ningún cambio |
| CA-7 | PARCIAL (documentado, no es hallazgo) | `EventsLandingPage.tsx:34-68` renderiza en orden: header (36), sección "destacados" como grid plano en vez de carrusel (38-52, deferido), filtro de categorías (58-63), grid principal (64); footer se agrega en `page.tsx:8` |
| CA-8 | CUMPLE | `SiteHeader.tsx:7,9-14` importa `Input` y `Sheet` de shadcn; uso real en líneas 50-57 (desktop) y 85-113 (mobile) |
| CA-9 | NO CUBIERTO (diferido, no es hallazgo) | No existe `FeaturedEventsCarousel.tsx` ni `src/components/ui/carousel.tsx` en el árbol actual; consistente con `spec.md:6` y `plan.md:22` |
| CA-10 | CUMPLE | `CategoryFilter.tsx:3,13-21,29-42` usa `Tabs/TabsList/TabsTrigger`, incluye opción "Todos"; filtrado real verificado en `EventsLandingPage.test.tsx:70-106` (clic en "Conciertos" filtra el grid) y `CategoryFilter.test.tsx:8-17` |
| CA-11 | CUMPLE | `useEventFilters.ts:15-28` — coincidencia parcial case-insensitive sobre `title` (línea 21) combinada con AND (línea 26); cubierto sin red por `useEventFilters.test.ts:45-91`, incluyendo el caso explícito de AND (líneas 66-81) |
| CA-12 | CUMPLE | `EventsGrid.tsx:18-26` renderiza `EventCardSkeleton` mientras `isLoading`; `EventsGrid.test.tsx:35-41` verifica skeletons y ausencia de cards |
| CA-13 | CUMPLE | `EventsGrid.tsx:28-34` mensaje de vacío sin cards ni skeletons; `EventsGrid.test.tsx:43-50` lo verifica |
| CA-14 | CUMPLE | `EventCard.tsx:31-60` — imagen `next/image` con `alt={event.title}` (línea 37), título (43), fecha vía `formatEventDate` (44), venue+ciudad (48-51), precio vía `formatCurrency` (54-56), `Badge` con categoría (47); cubierto por `EventCard.test.tsx` completo |
| CA-15 | CUMPLE | `grep "dark:"` sobre `src/modules/events` y `src/components/layout` no encuentra coincidencias; no hay `ThemeToggle`/`useTheme` fuera de `src/app/providers.tsx` (preexistente, no tocado por esta feature) |
| CA-16 | CUMPLE | Ver sección Verificación — `npm run lint` y `npx tsc --noEmit` sin errores |
| CA-17 | CUMPLE | Ver sección Verificación — 32 tests / 10 archivos, incluyendo los 9 test files pedidos por el spec (`eventsService`, `useEventFilters`, `CategoryFilter`, `EventsGrid`, `EventCard`, `SiteHeader`, `EventsLandingPage`, `formatEventDate`, `formatCurrency`) |
| CA-18 | CUMPLE | `EventsGrid.tsx:20,37` clases `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`; `SiteHeader.tsx:60,72,78` nav oculta en mobile (`hidden md:flex`) y `Sheet` visible solo `md:hidden` |
| CA-19 | CUMPLE | `layout.tsx:18-22` — `title: "Ticketera — Entradas para tus eventos favoritos"`, ya no "Next.js Template" |

## Hallazgos

Ningún hallazgo bloqueante.

### H1 — [MENOR] Clases de grid responsive duplicadas entre `EventsGrid` y `EventsLandingPage`
- **Archivo:** `src/modules/events/components/EventsLandingPage.tsx:46` y `src/modules/events/components/EventsGrid.tsx:20,37`
- **Problema:** La cadena de clases `"grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"` aparece tres veces (dos en `EventsGrid`, una en la sección de destacados de `EventsLandingPage`). Es duplicación menor de presentación (DRY), no de lógica.
- **Corrección sugerida (no bloqueante):** extraer una constante compartida o un pequeño componente `EventsCardGrid` que envuelva children con esa clase, reutilizable entre destacados y grid principal.
- **Criterio afectado:** ninguno directamente (no incumple CA-18, que solo exige que las clases responsive existan y sean verificables — lo cual se cumple).

### H2 — [MENOR] Token `--highlight`/`--highlight-foreground` sin uso todavía
- **Archivo:** `src/app/globals.css:27-28,101-102`
- **Problema:** Los tokens ámbar quedan declarados y mapeados pero ningún componente de esta iteración los consume (estaban pensados para la cinta "Destacado" del carrusel, diferido a Iteración 2).
- **Corrección sugerida:** ninguna acción requerida ahora; queda correcto documentar que se activará junto con `FeaturedEventsCarousel` en la Iteración 2. Se anota solo para que no se pierda de vista.
- **Criterio afectado:** ninguno (CA-6 solo pide que el token exista y `.dark` quede intacto, ambas condiciones se cumplen).

## Verificación

- `npm run lint` → sin errores ni warnings.
- `npx tsc --noEmit` → sin errores.
- `npm test` (Vitest) → **32 tests pasados / 10 archivos pasados**, 0 fallos. Incluye los 9 archivos de test nuevos pedidos por el spec más `button.test.tsx` preexistente.

## Cierre para el orquestador

- **Veredicto:** APROBADO.
- **Bloqueantes:** 0.
- **Menores:** 2 (H1 — duplicación de clases de grid entre `EventsGrid.tsx` y `EventsLandingPage.tsx`; H2 — token `--highlight` aún sin consumidor, esperado hasta Iteración 2). Ninguno detiene la entrega ni dispara re-dispatch.
- Todos los CA-1 a CA-19 verificados; CA-7 queda PARCIAL y CA-9 NO CUBIERTO únicamente por el diferimiento documentado y ya aprobado del carrusel a la Iteración 2 — no requieren acción del developer en este ciclo.
