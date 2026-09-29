# Spec — Rediseño de la landing (modo claro, hero en carrusel, categorías y próximos eventos)

> **Estado:** APROBADO
> **Aprobado por:** Usuario (ronaldreyesramirez@gmail.com), 2026-09-25 ("sii").
> **Solicitado por:** Usuario (ronaldreyesramirez@gmail.com), 2026-09-25 — "realiza todo recomendado" (opción A: el rediseño **absorbe la Iteración 2b** de `docs/specs/events-landing/`).
> **Relación con specs previos:** Parte de lo ya construido en `events-landing` (Iteración 1 + 2a, implementadas). Los criterios CA-20 a CA-28 de la Iteración 2b de ese spec quedan **reemplazados** por este documento; el plan de `events-landing` no ejecuta 2b.

## Objetivo

Llevar la landing `/` a un diseño moderno de ticketera en modo claro, alineado con los patrones de las referencias del rubro (Ticketmaster, Eventbrite, Fever/DICE, Joinnus):

1. un **hero llamativo en carrusel** cuyos textos se lean siempre bien sobre la imagen;
2. **categorías** presentadas como una fila amigable de íconos redondos;
3. **próximos eventos** ordenados por fecha, con tarjetas que destaquen fecha, categoría y precio;
4. la barra de búsqueda con filtros de **fecha y precio** pendiente de la Iteración 2b.

## Referencias y patrones adoptados

| Patrón observado | Dónde | Cómo se adopta |
| --- | --- | --- |
| Hero a todo el ancho con imagen, degradado oscuro del lado del texto, título grande + fecha/lugar + CTA | Ticketmaster, Eventbrite, DICE | `FeaturedEventsHero` con overlay degradado fijo (no depende de la foto) |
| Carrusel con paginación por puntos, flechas en desktop, autoplay que pausa al interactuar | Ticketmaster, Joinnus | Swiper con `Autoplay`, `Pagination`, `Navigation`, `A11y` |
| Categorías como íconos circulares en fila con scroll horizontal | Eventbrite, Fever | `CategoryFilter` v3: chips circulares con color suave por categoría |
| Tarjeta con bloque de fecha (día grande + mes corto) sobre la imagen, badge de categoría, "Desde $X" | Eventbrite, Fever, DICE | `EventCard` rediseñado |
| Listado principal "Próximos eventos" ordenado por fecha | Fever, Eventbrite | Grid principal ordenado ascendente por fecha |

## Alcance

### Dentro

- **Hero** `FeaturedEventsHero.tsx` con `swiper/react`: una slide por evento `featured: true`.
- **Header dividido:** `SiteNavbar` (ya creado en 2a, se wirea) + `SiteTopbar` nuevo, sticky, con búsqueda, fecha (`Popover` + `Calendar` rango) y precio (`Slider` de dos manijas). `SiteHeader.tsx` y su test se eliminan.
- **Categorías:** `CategoryFilter` pasa de grid de `Card` a fila horizontal de chips circulares con ícono y color por categoría. Se mantiene el contrato `value`/`onValueChange` y `aria-pressed`.
- **Tarjeta de evento** rediseñada: bloque de fecha superpuesto, badge de categoría, título, lugar, "Desde <precio>" y un leve zoom de la imagen en hover.
- **Próximos eventos:** el grid principal se titula "Próximos eventos", muestra los eventos filtrados **ordenados por fecha ascendente** y usa 4 columnas en `lg`.
- **Mock data:** se mueven las fechas al futuro (oct-2026 a mar-2027) para que "próximos" tenga sentido. Se mantienen los invariantes de CA-2/CA-34.
- **Estilo general claro:** fondo `background`, secciones con títulos consistentes y paleta actual (`primary` violeta, `highlight` ámbar), tipografía Poppins. Sin tokens nuevos de modo oscuro.

### Fuera de alcance

- Dark mode o toggle de tema; el diseño es solo claro.
- Detalle de evento, checkout y la funcionalidad del CTA: "Comprar entradas" apunta a `#` hasta que exista la página de detalle.
- Filas temáticas adicionales ("Esta semana", "Cerca de ti"), ciudad/ubicación, ordenamiento elegible por el usuario, filtros en la URL.
- Excluir eventos pasados según la fecha real. Solo se ordena: filtrar por "hoy" haría que el mock data envejezca y rompa la página (KISS).
- Efectos de Swiper más allá del slide (fade, coverflow, miniaturas).
- Cambios en `SiteFooter`.

## Criterios de aceptación

### Prerrequisitos
- **CR-1** — `package.json` declara `swiper`, `react-day-picker` y `date-fns` en `dependencies`. Los instala **el usuario desde su terminal**: `npm install swiper react-day-picker date-fns` (EALLOWSCRIPTS, ver CLAUDE.md).
- **CR-2** — `src/components/ui/calendar.tsx` existe, instalado con `npx shadcn@latest add calendar` después de CR-1.

### Hero
- **CR-3** — `src/modules/events/components/FeaturedEventsHero.tsx` recibe `events: Event[]` y renderiza con `Swiper`/`SwiperSlide` de `swiper/react` una slide por cada evento; `EventsLandingPage` le pasa solo los `featured: true`. La fila plana de destacados en grid deja de existir en `EventsLandingPage.tsx`.
- **CR-4** — Swiper se configura con los módulos `Autoplay` (delay 6000 ms, `pauseOnMouseEnter: true`, `disableOnInteraction: false`), `Pagination` (`clickable: true`), `Navigation` (flechas visibles solo desde `md`), `A11y` y `loop: true` cuando hay más de una slide.
- **CR-5** — **Legibilidad:** cada slide tiene la imagen (`next/image`, `fill`, `object-cover`, `priority` en la primera slide) y encima una capa de degradado fija, independiente de la foto: `bg-gradient-to-t from-black/85 via-black/50 to-black/10` en mobile y `md:bg-gradient-to-r md:from-black/85 md:via-black/55 md:to-transparent` en desktop. El texto va en blanco sobre la zona más oscura del degradado (abajo en mobile, izquierda en desktop).
- **CR-6** — Contenido de cada slide: `Badge` de categoría (etiqueta en español), título como `h2` (`text-3xl md:text-5xl font-bold`), fecha formateada con `formatEventDate`, lugar y ciudad con ícono, precio "Desde <formatCurrency>" y un `Button` "Comprar entradas" (`href="#"`).
- **CR-7** — Alto del hero: `h-[440px] md:h-[520px]`, esquinas `rounded-3xl`, contenido dentro del mismo `max-w` que el resto de la página. Mientras `isLoading` se muestra un `Skeleton` con ese mismo alto (sin salto de layout). Si no hay destacados, la sección no se renderiza.

### Header
- **CR-8** — `SiteHeader.tsx` y `SiteHeader.test.tsx` no existen. `EventsLandingPage` renderiza `<SiteNavbar />` y luego `<SiteTopbar … />`, antes de `<main>`.
- **CR-9** — `SiteNavbar` no es `sticky` ni `fixed` y no contiene inputs de búsqueda.
- **CR-10** — El elemento raíz de `SiteTopbar` tiene `sticky top-0` y un `z-*`, fondo `bg-background/90 backdrop-blur` y borde inferior. Contiene **un solo** `Input` de búsqueda; escribir invoca `onSearchChange`.
- **CR-11** — Filtro de fecha: `Popover` + `Calendar mode="range"`. El trigger muestra "Fecha" sin rango, o el rango elegido. Al elegir se invoca `onDateRangeChange({ from, to })` en formato `YYYY-MM-DD` (o `null`). Incluye una acción para limpiar el rango.
- **CR-12** — Filtro de precio: `Popover` + `Slider` de dos manijas acotado por `priceBounds`. El trigger muestra "Precio" o el rango con `formatCurrency`. Mover el slider invoca `onPriceRangeChange({ min, max })`.
- **CR-13** — En mobile (`< md`) los tres controles caben en la barra: búsqueda a todo el ancho y fecha/precio como botones compactos debajo o al lado, sin scroll horizontal de página.

### Categorías
- **CR-14** — `CategoryFilter` renderiza "Todos" + las 9 categorías como botones en **una fila con scroll horizontal** (`overflow-x-auto`, `snap-x`, sin barra de scroll visible). Cada botón tiene un círculo de ícono (`size-16`) con fondo suave de color propio por categoría y su etiqueta debajo.
- **CR-15** — La categoría activa lleva `aria-pressed="true"` y un anillo `ring-primary` en el círculo; las demás, `aria-pressed="false"`. El clic invoca `onValueChange(valor)`. Contrato y tests de CA-35 se mantienen.
- **CR-16** — La sección tiene el título "Explora por categoría" y se ubica entre el hero y "Próximos eventos".

### Próximos eventos y tarjeta
- **CR-17** — Existe la función pura `sortEventsByDate(events: Event[]): Event[]` en `useEventFilters.ts`: devuelve una **copia** ordenada por `date` ascendente sin mutar la entrada. `EventsLandingPage` la aplica al resultado de `useEventFilters`.
- **CR-18** — La sección se titula "Próximos eventos" y muestra el conteo de resultados ("N eventos"). `EventsGrid` usa `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, igual para el skeleton.
- **CR-19** — `EventCard` rediseñada:
  - (a) imagen `aspect-[4/3]` con `rounded-2xl` y `group-hover:scale-105`;
  - (b) bloque de fecha blanco sobre la esquina superior izquierda de la imagen, con día numérico grande y mes abreviado en mayúsculas (p. ej. "14" / "MAR");
  - (c) `Badge` de categoría;
  - (d) título con `line-clamp-2`;
  - (e) lugar y ciudad con ícono;
  - (f) "Desde" + precio con `formatCurrency`.
- **CR-20** — `formatEventDate.ts` exporta además `getEventDateParts(isoDate): { day: string; month: string } | null` (UTC, `es-ES`, mes corto en mayúsculas sin punto). Devuelve `null` para fechas inválidas; en ese caso la tarjeta omite el bloque de fecha.
- **CR-21** — `EventCardSkeleton` refleja la nueva forma de la tarjeta.

### Datos
- **CR-22** — Todas las fechas del mock en `eventsService.ts` están entre 2026-10-01 y 2027-03-31. Los invariantes siguen en verde: ≥10 eventos, ≥1 por categoría (9), ≥3 destacados, imágenes en `images.unsplash.com`.

### Calidad
- **CR-23** — Toda etiqueta de categoría en español proviene de **una única** fuente: `CATEGORY_LABELS`, exportada desde un archivo del módulo y reutilizada por `EventCard`, `FeaturedEventsHero` y `CategoryFilter`. No hay mapas duplicados (DRY).
  *Precisión de planificación:* la fuente única se implementa como un solo objeto `CATEGORY_META: Record<EventCategory, { label; filterLabel; icon; toneClassName }>` en `src/modules/events/categories.ts`, porque la tarjeta usa singular ("Concierto") y el filtro plural ("Conciertos"). Reemplaza a los tres mapas `CATEGORY_LABELS`/`CATEGORY_ICONS`/`CATEGORY_COLORS` mencionados abajo; la intención (fuente única) no cambia.
- **CR-24** — `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.

## Inventario de reutilización

| Pieza | Decisión | Detalle |
| --- | --- | --- |
| `swiper` | INSTALAR (usuario) | Decisión previa explícita del usuario (Iteración 2) sobre shadcn `Carousel` |
| `react-day-picker`, `date-fns` | INSTALAR (usuario) | Dependencias del `calendar` de shadcn |
| shadcn `calendar` | INSTALAR (orquestador) | Tras CR-1 |
| shadcn `popover`, `slider`, `badge`, `button`, `input`, `skeleton`, `sheet` | REUTILIZAR | Ya en `src/components/ui/` |
| `SiteNavbar.tsx` | REUTILIZAR | Creado en 2a, se wirea sin cambios de contrato |
| `filterEvents`, `getPriceBounds`, `DateRangeFilter`, `PriceRangeFilter` | REUTILIZAR | `useEventFilters.ts` (2a) |
| `formatCurrency`, `formatEventDate`, `cn` | REUTILIZAR | `src/lib/` |
| Íconos de categoría | REUTILIZAR | Mapeo de `lucide-react` ya definido en `CategoryFilter` |
| `CATEGORY_LABELS` | MOVER | De `EventCard.tsx` a `src/modules/events/categories.ts` (con `CATEGORY_ICONS` y colores), fuente única |
| `sortEventsByDate` | CREAR | Función pura en `useEventFilters.ts` |
| `getEventDateParts` | CREAR | En `src/lib/formatEventDate.ts`, junto a `formatEventDate` |
| `FeaturedEventsHero.tsx` | CREAR | `src/modules/events/components/` |
| `SiteTopbar.tsx` (+ test) | CREAR | `src/components/layout/`, sin conocimiento del dominio (todo por props) |

## Impacto en la estructura

**Zona compartida (serial, orquestador, antes del lote paralelo):**
- CR-1 (usuario) → CR-2 (`shadcn add calendar`).
- Crear `src/modules/events/categories.ts`: `CATEGORY_LABELS`, `CATEGORY_ICONS` y `CATEGORY_COLORS` (clases Tailwind de fondo/texto suaves por categoría). Es el contrato que consumen tres tareas.

**Archivos nuevos:** `src/modules/events/categories.ts`, `src/modules/events/components/FeaturedEventsHero.tsx`, `src/components/layout/SiteTopbar.tsx`, `src/components/layout/SiteTopbar.test.tsx`.

**Modificados:**
- `EventCard.tsx` (+test)
- `EventCardSkeleton.tsx`
- `EventsGrid.tsx` (+test si aplica)
- `CategoryFilter.tsx` (+test)
- `useEventFilters.ts` (+test)
- `eventsService.ts` (+test)
- `src/lib/formatEventDate.ts` (+test)
- `EventsLandingPage.tsx` (+test)

**Eliminados:** `src/components/layout/SiteHeader.tsx`, `SiteHeader.test.tsx`.

`index.ts` del módulo: sin cambios de contrato.

## Requisitos de testing

- `useEventFilters.test.ts`: `sortEventsByDate` ordena de forma ascendente y no muta la entrada.
- `formatEventDate.test.ts`: `getEventDateParts` para una fecha válida (día/mes esperados en UTC) y para una inválida (`null`).
- `EventCard.test.tsx`: muestra el bloque de fecha, la etiqueta de categoría, el título, el lugar y "Desde"+precio.
- `CategoryFilter.test.tsx`: renderiza 10 botones; `aria-pressed` correcto; el clic invoca `onValueChange`.
- `SiteTopbar.test.tsx`: la búsqueda invoca `onSearchChange`; el trigger de fecha abre el popover y muestra el calendario; el trigger de precio muestra el rango formateado (se prueba el wiring, no las primitivas internas).
- `eventsService.test.ts`: agrega la aserción de rango de fechas de CR-22.
- `EventsLandingPage.test.tsx`: el input de búsqueda es único; categoría + búsqueda siguen con AND; los resultados aparecen ordenados por fecha. **Swiper se mockea** en este test (`vi.mock("swiper/react")` renderiza los children), porque jsdom no implementa `ResizeObserver`.
- Sin test dedicado: `FeaturedEventsHero` (composición de Swiper, ya probado upstream) y `SiteNavbar` (estático).

## Riesgos y decisiones

- **Bloqueante de ejecución:** la implementación no arranca hasta CR-1. Hace falta `npm install swiper react-day-picker date-fns` desde tu terminal.
- **Autoplay:** mejora el "llamativo" pedido, pero se pausa al pasar el mouse. `A11y` agrega etiquetas a flechas y paginación.
- **Contraste:** el degradado es fijo (CR-5), así que la legibilidad no depende de cada foto. Las fotos muy claras siguen quedando cubiertas por `black/85` en la zona del texto.
- **CSS de Swiper:** los imports `swiper/css`, `swiper/css/pagination` y `swiper/css/navigation` van dentro de `FeaturedEventsHero.tsx`, no en `globals.css`. Los colores de bullets y flechas se ajustan con clases o variables `--swiper-*` locales al componente.
- **Fechas del mock:** se mueven al futuro para que "Próximos eventos" sea creíble. No se filtra por fecha real (ver Fuera de alcance).
