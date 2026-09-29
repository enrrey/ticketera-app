# Spec — Landing page de eventos (mock data) + design system base

> **Estado:** APROBADO
> **Aprobado por:** Usuario (ronaldreyesramirez@gmail.com)
> **Fecha:** 2026-09-25
> **Nota:** Iteración 2 aprobada tal cual (categorías e íconos propuestos, sin cambios). Verificado en `package.json`: `swiper`, `react-day-picker` y `date-fns` **aún no están instalados**. Se ejecuta primero la porción de la Iteración 2 que no depende de ellos ("Iteración 2a" en `plan.md`); `FeaturedEventsHero` y `SiteTopbar` completo quedan en "Iteración 2b", pendientes de que el usuario corra `npm install swiper` y `npm install react-day-picker date-fns`.
> **Nota:** La Iteración 1 (secciones "Objetivo" a "Riesgos y preguntas abiertas" originales, más abajo) fue aprobada por el usuario (ronaldreyesramirez@gmail.com, 2026-09-25) e implementada tal cual — ver `plan.md`. Esas secciones **no se modifican** en esta revisión. Este archivo vuelve a `PENDIENTE DE APROBACIÓN` porque se añadió la sección **"Iteración 2"** al final del documento, que amplía el alcance sobre la landing ya construida y requiere una nueva aprobación humana explícita antes de planificarse o implementarse.

## Objetivo

Construir la landing page pública de la ticketera (`/`) con datos mock de eventos — hero de destacados, filtro por categoría, buscador y grid de tarjetas de evento — reutilizando en su mayoría `shadcn/ui`, y dejar establecido el design system base del proyecto (tipografía Poppins global y paleta de color) para que las páginas futuras (detalle de evento, checkout, etc.) hereden una base consistente sin rehacer trabajo.

## Alcance

### Dentro

- Página `/` (`src/app/page.tsx`) con: header + buscador, carrusel de eventos destacados, filtro por categoría, grid de tarjetas de evento, footer.
- Módulo `src/modules/events/` con mock data (servicio simulando async, sin backend real).
- Cambio **global** de tipografía a Poppins (`next/font/google`) vía `src/app/layout.tsx` + `src/app/globals.css`.
- Ajuste de la paleta de color en `:root` de `src/app/globals.css` (color primario/marca), sin tocar `.dark`.
- Configuración de `next.config.ts` para permitir imágenes remotas de `images.unsplash.com`.
- Instalación de los componentes shadcn necesarios (ver inventario).
- Solo modo claro: sin toggle de tema, sin clases `dark:` propias del dominio evento.

### Fuera de alcance

- Página de detalle de evento, checkout, autenticación.
- Dark mode / toggle de tema (next-themes queda instalado y funcional para uso futuro, pero esta feature no lo expone).
- Backend real / API — todo es mock data servido desde el módulo `events`.
- Internacionalización.
- Buscador con autocompletado, sugerencias o debounce avanzado (filtrado simple en cliente sobre el array mock).
- Ordenamiento (sort by fecha/precio) — no fue pedido; se puede añadir después reutilizando `Select` de shadcn sin fricción.
- Paginación del grid — con mock data un único grid es suficiente (YAGNI).

No se propone partir esta iteración en sub-specs adicionales: "solo landing" ya es el corte natural. Es una feature de tamaño considerable para una sesión (toca tipografía/color globales + ~8 instalaciones shadcn + un módulo completo), pero está acotada porque casi todo es composición sobre primitivas ya existentes. Se sugiere que el plan de implementación secuencie primero los cambios de zona compartida (fuentes, colores, `next.config.ts`, instalaciones shadcn) antes de repartir el resto en tareas paralelas de archivos disjuntos — esto es indicación para el plan, no una re-partición de la spec.

## Criterios de aceptación

- **CA-1** — Existe `src/modules/events/` con `components/`, `hooks/`, `services/`, `types.ts`, `index.ts`, siguiendo `docs/SETUP.md`. `src/app/page.tsx` únicamente importa desde `@/modules/events` (barrel) y `@/components/layout/SiteFooter`; no contiene JSX de secciones propias ni lógica de filtrado/estado.
- **CA-2** — `eventsService` expone una función que retorna `Promise<Event[]>` (simulando latencia async, p. ej. con `setTimeout`) con al menos 10 eventos mock, al menos un evento por cada valor de `EventCategory`, y al menos 3 eventos con `featured: true`.
- **CA-3** — Todos los `imageUrl` del mock data apuntan a `https://images.unsplash.com/...` (dominio real, no placeholder genérico tipo `picsum.photos` o `via.placeholder.com`).
- **CA-4** — `next.config.ts` declara `images.remotePatterns` incluyendo `hostname: "images.unsplash.com"`; las imágenes de evento se renderizan con `next/image` sin error de "Invalid src prop".
- **CA-5** — `src/app/layout.tsx` importa `Poppins` de `next/font/google` y `src/app/globals.css` mapea `--font-sans: var(--font-poppins)` dentro de `@theme inline`. Geist deja de ser la fuente activa de `--font-sans` (puede seguir importado para `--font-mono`, eso no cambia en esta feature).
- **CA-6** — `src/app/globals.css` define en el bloque `:root` un `--primary` (y `--primary-foreground`, `--ring`) distinto del gris neutro por defecto de `base-nova` (`oklch(0.205 0 0)`). El bloque `.dark` queda **byte a byte idéntico** al estado previo a esta feature (ningún diff en esas líneas).
- **CA-7** — La página `/` renderiza, en este orden vertical: header (logo + buscador + navegación), carrusel de eventos destacados, filtro de categorías, grid de tarjetas de evento, footer.
- **CA-8** — El header (`SiteHeader`) usa `Input` de shadcn para el buscador y `Sheet` de shadcn para el menú en viewport mobile (verificable por los imports en `SiteHeader.tsx`).
- **CA-9** — El carrusel de destacados usa `Carousel`/`CarouselContent`/`CarouselItem` de shadcn (`@/components/ui/carousel`) y renderiza únicamente los eventos con `featured: true`.
- **CA-10** — El filtro de categorías usa `Tabs`/`TabsList`/`TabsTrigger` de shadcn, incluye una opción "Todos" además de las categorías reales; al seleccionar una categoría distinta de "Todos", el grid muestra solo eventos de esa categoría (cubierto por test RTL).
- **CA-11** — El input de búsqueda filtra eventos por coincidencia parcial e insensible a mayúsculas/minúsculas sobre el título; el filtro de búsqueda y el de categoría se combinan con AND, no con OR (cubierto por test unitario de `useEventFilters`, sin necesidad de mockear red).
- **CA-12** — Mientras la carga de eventos está en curso (`isLoading`), `EventsGrid` renderiza placeholders (`EventCardSkeleton`, basado en `Skeleton` de shadcn) en vez de `EventCard`; test RTL lo verifica con la query en estado pendiente.
- **CA-13** — Si la combinación de búsqueda + categoría no produce resultados, `EventsGrid` muestra un mensaje de estado vacío visible y no renderiza ningún `EventCard` ni skeleton.
- **CA-14** — Cada `EventCard` muestra: imagen (`next/image` con `alt` no vacío y descriptivo), título, fecha formateada en formato legible (no el ISO string crudo), venue + ciudad, precio formateado con símbolo de moneda, y un `Badge` de shadcn con el nombre de la categoría.
- **CA-15** — Ningún archivo nuevo de esta feature agrega un control de cambio de tema ni clases `dark:` propias del dominio evento; los únicos estilos `dark:` presentes en el DOM final son los ya incluidos de fábrica dentro de los componentes shadcn instalados.
- **CA-16** — `npm run typecheck` y `npm run lint` pasan sin errores nuevos atribuibles a esta feature.
- **CA-17** — `npm test` pasa incluyendo, como mínimo, tests nuevos para `eventsService`, `useEventFilters`, `CategoryFilter`, `EventsGrid`, `EventCard`, `SiteHeader` (comportamiento del input de búsqueda) y un test de integración de `EventsLandingPage` que cubre búsqueda + filtro de categoría actuando juntos.
- **CA-18** — El grid de eventos usa clases responsive de Tailwind (ej. `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) verificables en `EventsGrid.tsx`, y el menú de navegación colapsa a `Sheet` en viewport mobile.
- **CA-19** — `src/app/layout.tsx` actualiza el `title`/`description` en `metadata` para reflejar el producto real (ya no "Next.js Template"/"Template base para aplicaciones web con Next.js").

## Inventario de reutilización

Confirmado por exploración: hoy `src/components/ui/` solo contiene `button.tsx` (+ su test); `src/lib/` solo contiene `utils.ts` (re-exporta `cn` del paquete `cn`); `src/hooks/` no existe todavía; no hay ningún `src/modules/*` previo.

| Pieza | Decisión | Detalle |
| --- | --- | --- |
| Botón | REUTILIZAR | `src/components/ui/button.tsx` (variantes `default`/`outline`/`ghost`/`link` cubren CTAs del hero, header y footer) |
| `cn()` | REUTILIZAR | `src/lib/utils.ts` (re-exporta `cn`) |
| Iconos (búsqueda, menú, ubicación, calendario, etc.) | REUTILIZAR | `lucide-react`, ya instalado; no se propone otra librería de iconos |
| Cliente de datos (`useQuery`) | REUTILIZAR | `@tanstack/react-query`, ya provisto por `src/app/providers.tsx` (`QueryClientProvider`); `useEvents` solo lo consume, no crea un cliente nuevo |
| Card | INSTALAR (shadcn) | `npx shadcn@latest add card` → `src/components/ui/card.tsx` |
| Badge | INSTALAR (shadcn) | `npx shadcn@latest add badge` → `src/components/ui/badge.tsx` |
| Input | INSTALAR (shadcn) | `npx shadcn@latest add input` → `src/components/ui/input.tsx` |
| Separator | INSTALAR (shadcn) | `npx shadcn@latest add separator` → `src/components/ui/separator.tsx` (divisores en footer) |
| Skeleton | INSTALAR (shadcn) | `npx shadcn@latest add skeleton` → `src/components/ui/skeleton.tsx` (loading state del grid) |
| Sheet | INSTALAR (shadcn) | `npx shadcn@latest add sheet` → `src/components/ui/sheet.tsx` (menú mobile del header) |
| Tabs | INSTALAR (shadcn) | `npx shadcn@latest add tabs` → `src/components/ui/tabs.tsx` (filtro de categoría) |
| Carousel | INSTALAR (shadcn) | `npx shadcn@latest add carousel` → `src/components/ui/carousel.tsx`. **Riesgo/prerrequisito**, ver sección de Riesgos: requiere `embla-carousel-react`, que no está instalado. |
| Navigation Menu | DESCARTADO | Pensado para mega-menús con submenús desplegables; el header de esta landing es una barra simple (logo + links + buscador). Usarlo sería sobre-ingeniería (KISS); si en el futuro aparecen submenús por categoría se puede instalar entonces |
| Select / Dropdown Menu | DESCARTADO (por ahora) | El filtro de categoría se resuelve con `Tabs` (más visual, mejor UX para 6-7 opciones, patrón usado por ticketmaster/joinnus). No hay requerimiento de "ordenar por" en esta iteración (YAGNI); si se pide luego, `Select` se instala sin fricción |
| Avatar | DESCARTADO | No hay sesión de usuario ni perfil visible en la landing (fuera de alcance: autenticación) |
| Menubar | DESCARTADO | Redundante con `Tabs` + `Sheet` para las necesidades de navegación de esta página |
| `Event`, `EventCategory` (tipos) | CREAR | No existe equivalente; van en `src/modules/events/types.ts` |
| `eventsService.ts` | CREAR | No existe; mock data + función async simulada, no hay servicio de eventos previo en el proyecto |
| `useEventFilters.ts` | CREAR | No existe; lógica pura de filtrado (búsqueda + categoría) separada de la obtención de datos para que sea testeable sin red |
| `useEvents.ts` | CREAR | No existe; wrapper delgado de `useQuery` sobre `eventsService` |
| `EventCard.tsx` | CREAR | Composición específica del dominio evento (imagen + fecha + venue + precio + badge); no existe nada equivalente en `ui/` ni en shadcn (shadcn no ofrece una "event card") |
| `EventCardSkeleton.tsx` | CREAR | Composición de `Skeleton` con las dimensiones de `EventCard`; no existe |
| `FeaturedEventsCarousel.tsx` | CREAR | Composición de `Carousel` + slides de evento destacado |
| `CategoryFilter.tsx` | CREAR | Composición de `Tabs` con las categorías del dominio evento |
| `EventsGrid.tsx` | CREAR | Orquesta estados loading/empty/data del grid |
| `EventsLandingPage.tsx` | CREAR | Componente cliente que compone header + carrusel + filtro + grid y posee el estado de búsqueda/categoría (vía los hooks de arriba); es lo que exporta el barrel y consume `src/app/page.tsx` |
| `formatEventDate.ts` | CREAR | No existe utilidad de formateo de fecha en `src/lib/`; se ubica ahí (no en `modules/events/`) por ser genérica y previsiblemente reutilizable por futuras páginas (detalle de evento, checkout) |
| `formatCurrency.ts` | CREAR | Mismo razonamiento que `formatEventDate`: utilidad genérica en `src/lib/` |
| `SiteHeader.tsx` | CREAR | No es específico del dominio evento (es chrome de sitio); se ubica en `src/components/layout/` (ver "Impacto en la estructura" para la justificación) |
| `SiteFooter.tsx` | CREAR | Igual razonamiento que `SiteHeader` |

Resumen: **4 piezas reutilizadas**, **8 instalaciones de shadcn**, **~15 piezas nuevas** (todas composición delgada sobre primitivas existentes o mock data — nada reinventa una primitiva de UI que shadcn ya resuelve), **4 evaluadas y descartadas** con justificación.

## Impacto en la estructura

Cambios en zona compartida (secuenciales, un único owner, antes que el resto — ver Riesgos):

- `src/app/layout.tsx` — Poppins reemplaza a Geist Sans como `--font-sans`; actualiza `metadata`.
- `src/app/globals.css` — nuevos tokens de color en `:root` (`--primary`, `--primary-foreground`, `--ring`, opcionalmente `--highlight`/`--highlight-foreground` para el badge de "destacado"); mapeo de `--font-sans` en `@theme inline`. `.dark` no se toca.
- `next.config.ts` — `images.remotePatterns` para `images.unsplash.com`.
- `components.json` no cambia.
- Instalación shadcn de: `card`, `badge`, `input`, `separator`, `skeleton`, `sheet`, `tabs`, `carousel` (genera archivos en `src/components/ui/`).

Módulo de dominio:

```
src/modules/events/
  components/
    EventCard.tsx
    EventCard.test.tsx
    EventCardSkeleton.tsx
    FeaturedEventsCarousel.tsx
    CategoryFilter.tsx
    CategoryFilter.test.tsx
    EventsGrid.tsx
    EventsGrid.test.tsx
    EventsLandingPage.tsx
    EventsLandingPage.test.tsx
  hooks/
    useEventFilters.ts
    useEventFilters.test.ts
    useEvents.ts
  services/
    eventsService.ts
    eventsService.test.ts
  types.ts
  index.ts
```

Compartido, sin dominio:

```
src/components/layout/
  SiteHeader.tsx
  SiteHeader.test.tsx
  SiteFooter.tsx
src/lib/
  formatEventDate.ts
  formatEventDate.test.ts
  formatCurrency.ts
  formatCurrency.test.ts
```

Ruta App Router afectada:

```
src/app/page.tsx   # reescrito, delgado
```

`src/app/page.tsx` objetivo (ilustrativo, no es código final del developer):

```tsx
import { EventsLandingPage } from "@/modules/events";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function Home() {
  return (
    <>
      <EventsLandingPage />
      <SiteFooter />
    </>
  );
}
```

**Decisión documentada — header/footer fuera del módulo `events`:** `SiteHeader` y `SiteFooter` son chrome de sitio (logo, navegación, links legales) sin conocimiento del dominio "evento": no importan tipos ni servicios de `modules/events`. `SiteHeader` es puramente presentacional y recibe `searchValue`/`onSearchChange` como props (controlado desde afuera); quien posee el estado de búsqueda es `EventsLandingPage` (dentro del módulo), que renderiza `<SiteHeader searchValue={...} onSearchChange={...} />` junto con el resto de secciones. Esto respeta SOLID (el header depende de una abstracción — props genéricas — no de un hook concreto del dominio) y dejará `SiteHeader`/`SiteFooter` listos para reutilizarse en las páginas futuras sin arrastrar lógica de eventos. Por YAGNI, esta feature **no** los mueve a `src/app/layout.tsx` (eso obligaría a resolver el estado de búsqueda entre layout y page, complejidad no pedida); queda como nota para cuando exista una segunda página que los necesite.

## Sistema de diseño

### 1. Paleta de color

Se mantiene la escala neutral de `base-nova`/`neutral` (backgrounds, foregrounds, bordes, muted) tal cual viene hoy — es la que ya usan `Card`, `Input`, etc. Se toca únicamente el color de marca:

- **Primario**: violeta (asociación habitual con entretenimiento/tickets, distinto del gris por defecto). Propuesta de valores en `:root` (formato `oklch`, consistente con el resto del archivo):
  - `--primary: oklch(0.541 0.281 293.009)` (equivalente a un violeta ~600 de Tailwind)
  - `--primary-foreground: oklch(0.985 0 0)` (blanco, ya existente, se reutiliza)
  - `--ring: oklch(0.541 0.281 293.009)` (mismo tono, para que el focus ring combine con la marca)
- **Acento opcional** para la cinta/"badge" de evento destacado en el carrusel — un token nuevo, aditivo, que no reemplaza `--accent` (ese se deja intacto para hovers sutiles de shadcn):
  - `--highlight: oklch(0.769 0.188 70.08)` (ámbar)
  - `--highlight-foreground: oklch(0.145 0 0)`
  - Mapeados en `@theme inline` como `--color-highlight` / `--color-highlight-foreground` para poder usarse como `bg-highlight text-highlight-foreground`.
- Ningún otro token de color cambia. `secondary`, `muted`, `accent`, `destructive`, `border`, `input` se reutilizan tal cual (ya sirven para hovers, badges de "agotado", etc.).
- **No se toca `.dark`**: como los tokens nuevos (`--highlight`) solo se declaran en `:root`, si en el futuro se activa dark mode heredarán el valor claro por cascada (no se rompe nada, simplemente no está optimizado para oscuro todavía — aceptable porque dark mode es explícitamente fuera de alcance).

### 2. Tipografía

- Fuente: **Poppins**, vía `next/font/google`, pesos `400/500/600/700`, subset `latin`, variable `--font-poppins`.
- `src/app/layout.tsx`: se importa `Poppins` en vez de (o junto a) `Geist`, y `<html className>` incluye `poppins.variable`. `Geist_Mono` se mantiene igual (sigue siendo `--font-mono`; no se usa visiblemente en esta landing pero no hay motivo para tocarlo).
- `src/app/globals.css`, dentro de `@theme inline`: `--font-sans: var(--font-poppins)` (reemplaza a `--font-geist-sans`).
- **Esto es un cambio global**, no acotado a la landing: afecta a toda la app porque `body` ya usa `font-sans` en `@layer base`. Por eso va como tarea aislada de zona compartida en el plan, no en paralelo con nada que también toque `layout.tsx` o `globals.css` (la instalación de shadcn y el cambio de color sí tocan `globals.css`, así que las tres cosas — fuentes, colores, `next.config.ts` — se agrupan en una única tarea/PR inicial, secuencial, antes de repartir el resto).

### 3. Espaciado, radios y sombras

- Se reutiliza `--radius: 0.625rem` y la escala derivada (`--radius-sm/md/lg/xl`) de `base-nova` sin cambios: ya da tarjetas con esquinas suaves, consistentes con las referencias visuales.
- No se detecta necesidad de tokens de sombra adicionales; `Card` de shadcn ya trae una sombra sutil por defecto suficiente para diferenciar las tarjetas de evento del fondo.
- Espaciado: se usa la escala estándar de Tailwind (sin extensión), aplicada directamente en cada componente.

### 4. Inventario de secciones de la landing → componentes shadcn

| Sección | Inspiración | Componentes shadcn | Componente propio |
| --- | --- | --- | --- |
| Header con buscador y navegación | ticketmaster/joinnus: logo + barra de búsqueda + links + menú mobile | `Input`, `Button`, `Sheet` | `SiteHeader.tsx` |
| Hero / carrusel de destacados | Banner grande rotativo con CTA | `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious/Next`, `Badge` (etiqueta "Destacado") | `FeaturedEventsCarousel.tsx` |
| Filtro por categoría | Chips/tabs horizontales de categoría | `Tabs`, `TabsList`, `TabsTrigger` | `CategoryFilter.tsx` |
| Grid de eventos | Cards con imagen/fecha/lugar/precio | `Card`, `CardHeader/Content/Footer`, `Badge`, `Skeleton` | `EventCard.tsx`, `EventCardSkeleton.tsx`, `EventsGrid.tsx` |
| Footer | Links institucionales, columnas | `Separator` | `SiteFooter.tsx` |

### 5. Mock data — imágenes reales (Unsplash, verificadas como gratuitas/no premium)

Se usan URLs directas del CDN `images.unsplash.com` (no `source.unsplash.com`, que es un redirector aleatorio inestable), con parámetros de tamaño/formato para servir una imagen razonablemente liviana. Todas fueron verificadas una por una: son fotos "Free to use under the Unsplash License" (no `plus.unsplash.com`/premium).

| Categoría (`EventCategory`) | URL propuesta |
| --- | --- |
| `concert` | `https://images.unsplash.com/photo-1668934804631-e8337c891e65?q=80&w=1200&auto=format&fit=crop` |
| `concert` (variante 2, ej. evento de música clásica/orquesta) | `https://images.unsplash.com/photo-1719753458800-c09cfb167ac5?q=80&w=1200&auto=format&fit=crop` |
| `theater` | `https://images.unsplash.com/photo-1651437524278-b37b83a6e6d3?q=80&w=1200&auto=format&fit=crop` |
| `sports` | `https://images.unsplash.com/photo-1679391029864-d46f366a456b?q=80&w=1200&auto=format&fit=crop` |
| `festival` | `https://images.unsplash.com/photo-1761926826313-a1787661b7b6?q=80&w=1200&auto=format&fit=crop` |
| `conference` | `https://images.unsplash.com/photo-1582192730841-2a682d7375f9?q=80&w=1200&auto=format&fit=crop` |
| `exhibition` | `https://images.unsplash.com/photo-1569783721854-33a99b4c0bae?q=80&w=1200&auto=format&fit=crop` |
| Backup / evento adicional de concierto | `https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop` |

`EventCategory` propuesto: `"concert" | "theater" | "sports" | "festival" | "conference" | "exhibition"`. El developer puede reutilizar la misma URL para más de un evento mock dentro de la misma categoría (es dato de prueba, no un requisito de unicidad).

## Requisitos de testing

**Necesitan test (Vitest + RTL):**

- `eventsService.test.ts` — la función de obtención de eventos resuelve una promesa con el array esperado (longitud mínima, al menos un evento por categoría, al menos 3 `featured`); es lógica de datos, aunque sea mock.
- `useEventFilters.test.ts` — lógica pura de filtrado: por categoría, por texto de búsqueda (case-insensitive, coincidencia parcial), y ambos combinados con AND. No requiere red ni React Query.
- `CategoryFilter.test.tsx` — clic en una categoría dispara el callback con el valor correcto y refleja el estado activo.
- `EventsGrid.test.tsx` — comportamiento de las 3 ramas: loading (skeletons), vacío (mensaje), con datos (cards); tiene lógica condicional real.
- `EventCard.test.tsx` — dado un `Event` fixture, renderiza fecha formateada, precio formateado, badge de categoría y `alt` de imagen no vacío — hay lógica de formateo, no es solo passthrough visual.
- `SiteHeader.test.tsx` — escribir en el input dispara `onSearchChange` con el valor correcto (comportamiento controlado); no es necesario testear el comportamiento interno de `Sheet` (ya cubierto por shadcn/Radix-base upstream).
- `EventsLandingPage.test.tsx` — test de integración: mockeando `eventsService`, verifica que escribir en el buscador y seleccionar una categoría filtran el grid juntos (cubre el flujo completo de CA-11).
- `formatEventDate.test.ts` / `formatCurrency.test.ts` — funciones puras, casos borde mínimos (fecha inválida no rompe, formato de moneda con decimales).

**No necesitan test dedicado (con justificación):**

- `FeaturedEventsCarousel.tsx` — es composición directa de `Carousel` de shadcn/Embla; el comportamiento de swipe/autoplay/flechas es responsabilidad de esa librería (ya probada upstream). Un smoke test que verifique que renderiza sin crashear es opcional, no obligatorio.
- `EventCardSkeleton.tsx` — puramente visual (solo `Skeleton` con clases de tamaño), sin lógica.
- `SiteFooter.tsx` — contenido estático, sin estado ni props condicionales.
- `useEvents.ts` — es un wrapper delgado de `useQuery` que delega en `eventsService` (ya testeado) y en React Query (ya testeado upstream); no añade ramas propias. Si se quiere cobertura extra es vía el test de integración de `EventsLandingPage`, que ya lo ejercita indirectamente.

## Riesgos y preguntas abiertas

- **Prerrequisito de instalación (no bloqueante para la spec, sí para el plan de implementación):** `npx shadcn@latest add carousel` fallará en el paso "Installing dependencies" porque `embla-carousel-react` no está en `package.json`. Antes de que el developer ejecute ese `add`, el usuario debe correr `npm install embla-carousel-react` **desde su propia terminal** (Claude Code no puede instalar paquetes nuevos: falla con `EALLOWSCRIPTS`). El resto de instalaciones (`card`, `badge`, `input`, `separator`, `skeleton`, `sheet`, `tabs`) no dependen de paquetes ausentes y sí pueden ejecutarse desde Claude Code. Recomendado: pedir ese `npm install` al usuario como paso 0 del plan, antes de dispatchar al developer.
- **Zona compartida agrupada:** `layout.tsx`, `globals.css` y `next.config.ts` los debe tocar una sola tarea/agente, de forma secuencial y antes que cualquier trabajo paralelo sobre el módulo `events` o `components/layout/`, tal como exige CLAUDE.md para zonas compartidas.
- **Categorías elegidas** (`concert`, `theater`, `sports`, `festival`, `conference`, `exhibition`) son una propuesta razonable basada en imágenes de Unsplash verificadas como estables y gratuitas; no es una decisión de negocio compleja y es trivial de ajustar después (son mock data + un union type), así que no se marca como bloqueante — se puede afinar en la revisión del spec si el usuario prefiere otro set (p. ej. añadir "familiar"/"comedia").
- **Color primario (violeta) y acento (ámbar)** son una propuesta de diseño, no una decisión irreversible: son tokens CSS aislados, fáciles de retocar en la revisión humana de este spec sin impacto en la arquitectura.

No se identifican puntos **BLOQUEANTES** reales: no hay ambigüedad de arquitectura ni decisión que solo un humano pueda tomar antes de poder implementar. Las elecciones de color/categorías quedan abiertas a ajuste durante la aprobación humana de este mismo spec.

---

# Iteración 2 — Hero con Swiper, Navbar/Topbar con filtros de fecha y precio, y categorías ampliadas con íconos

> Amplía la landing ya implementada en Iteración 1 (`APROBADO` e implementada, secciones anteriores de este documento, sin cambios). Requiere nueva aprobación humana antes de generar `plan.md` para esta iteración o de dispatchar al `developer`.

## Objetivo

Reemplazar el hero de destacados por un carrusel real con **Swiper** (decisión explícita del usuario, reemplaza la elección previa de shadcn `Carousel`/`embla-carousel-react`); separar el header actual en **navbar** (logo + navegación) y **topbar** (búsqueda de texto + fecha + precio), con el topbar fijo (`sticky`) al hacer scroll; y ampliar el set de categorías de evento mostrándolas como tarjetas con íconos llamativos en vez de pestañas de texto.

## Alcance

### Dentro

- Hero de eventos destacados construido con la librería `swiper` (`swiper/react`), reemplazando la fila plana de `EventCard` que hoy renderiza `EventsLandingPage` para `featured: true`.
- División de `SiteHeader.tsx` en dos componentes nuevos: `SiteNavbar.tsx` (logo + navegación + menú mobile) y `SiteTopbar.tsx` (buscador de texto + filtro de fecha + filtro de precio). `SiteHeader.tsx`/`SiteHeader.test.tsx` se eliminan.
- El `SiteTopbar` queda fijo (`sticky`) en la parte superior de la ventana al hacer scroll; el `SiteNavbar` no es sticky (decisión documentada abajo).
- Filtro de fecha (rango desde-hasta) usando `Popover` + `Calendar` de shadcn.
- Filtro de precio (rango min-max) usando `Slider` de shadcn.
- Extensión de `useEventFilters`/`filterEvents` para combinar (AND) los filtros existentes (texto + categoría) con los nuevos (fecha + precio).
- Ampliación de `EventCategory` con 3 categorías nuevas: `family`, `comedy`, `cinema` (ver justificación en Riesgos/Notas), y actualización de todos los archivos que dependen de ese union type.
- Rediseño de `CategoryFilter.tsx`: cada categoría (incluyendo "Todos") se muestra como una `Card` de shadcn con un ícono de `lucide-react`, en vez de una `TabsTrigger` de texto plano.
- Actualización del mock data de `eventsService.ts` para cubrir las categorías nuevas, manteniendo los invariantes ya exigidos por CA-2 (≥10 eventos, ≥1 por categoría, ≥3 destacados) para el set ampliado de 9 categorías.

### Fuera de alcance

- Autoplay, miniaturas o efectos avanzados del hero de Swiper (fade, coverflow, etc.) — se usa la configuración por defecto de slides + navegación/paginación básicas; cualquier efecto adicional queda para una futura iteración si se pide explícitamente (YAGNI).
- Filtro de ubicación/ciudad, ordenamiento por fecha/precio, guardar filtros en la URL (querystring) o en `localStorage` — no fue pedido.
- Rango de fecha/precio persistente entre sesiones o compartible por link.
- Hacer sticky también el `SiteNavbar` (decisión explícita: no sticky, ver más abajo).
- Rediseño visual del `EventCard`, del grid o del footer — no fue pedido, solo cambian las etiquetas de categoría disponibles.
- Dark mode / nuevos tokens de color globales en `:root`/`.dark` (los colores de los íconos de categoría pueden usar clases de color estándar de Tailwind puntualmente, sin tocar `globals.css`).

## Criterios de aceptación

- **CA-20** — `package.json` declara `swiper` en `dependencies` (prerrequisito: el usuario lo instala desde su propia terminal, ver Riesgos).
- **CA-21** — Existe `src/modules/events/components/FeaturedEventsHero.tsx`, que importa `Swiper`/`SwiperSlide` desde `swiper/react` y renderiza un `SwiperSlide` por cada evento con `featured: true` del array recibido, y ninguno para eventos no destacados.
- **CA-22** — `EventsLandingPage.tsx` renderiza `FeaturedEventsHero` para la sección de destacados; la fila plana en grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` con `EventCard` directos) que hoy resuelve esa sección deja de existir en ese archivo.
- **CA-23** — `src/components/layout/SiteHeader.tsx` y `SiteHeader.test.tsx` ya no existen en el árbol de archivos; en su lugar existen `SiteNavbar.tsx` y `SiteTopbar.tsx` (con su test, ver requisitos de testing). `EventsLandingPage.tsx` renderiza `<SiteNavbar />` inmediatamente seguido de `<SiteTopbar ... />`, ambos antes del `<main>`.
- **CA-24** — `SiteNavbar.tsx` renderiza el logo, los links de navegación (desktop) y el trigger de `Sheet` para el menú mobile; no importa `Input` ni ningún control de fecha/precio, y no renderiza ningún elemento con `role="searchbox"` (verificable leyendo el archivo y/o por test).
- **CA-25** — `SiteTopbar.tsx` renderiza exactamente **un** `Input` de búsqueda de texto (sin la duplicación desktop/mobile que tenía `SiteHeader`), un control de fecha y un control de precio; escribir en el input de búsqueda invoca `onSearchChange` con el valor tecleado (test RTL, equivalente al que hoy cubre `SiteHeader.test.tsx`).
- **CA-26** — El elemento raíz de `SiteTopbar.tsx` incluye las clases Tailwind `sticky top-0` y un `z-*` que lo mantiene por encima del contenido de la página; el elemento raíz de `SiteNavbar.tsx` **no** incluye `sticky` ni `fixed` (permanece en flujo normal y se desplaza con el scroll). Ambos hechos son verificables inspeccionando el `className` renderizado en un test RTL o directamente en el código fuente.
- **CA-27** — El filtro de fecha se implementa con `Popover` + `Calendar` (`mode="range"`) de shadcn dentro de `SiteTopbar.tsx`; el botón disparador muestra un texto placeholder (p. ej. "Fecha") cuando no hay rango seleccionado, y al elegir un rango se invoca `onDateRangeChange` con `{ from: string | null; to: string | null }` (fechas en formato `YYYY-MM-DD`, sin hora).
- **CA-28** — El filtro de precio se implementa con `Slider` (rango de dos manijas) de shadcn dentro de `SiteTopbar.tsx`, acotado por una prop `priceBounds: { min: number; max: number }`; mover el slider invoca `onPriceRangeChange` con `{ min: number; max: number }`; el rango actual se muestra como texto usando la utilidad ya existente `formatCurrency` (reutilizada, no reimplementada).
- **CA-29** — La interfaz `EventFilters` en `useEventFilters.ts` gana los campos opcionales `dateRange?: { from: string | null; to: string | null }` y `priceRange?: { min: number | null; max: number | null }`; `filterEvents` combina estos dos filtros con los existentes (texto + categoría) usando semántica **AND**; cuando un campo de `dateRange`/`priceRange` es `null`/está ausente, no restringe esa dimensión (cubierto por test).
- **CA-30** — `filterEvents` interpreta `dateRange` de forma inclusiva sobre el día calendario de `event.date`: un evento coincide si su fecha cae entre `from` (inclusive, inicio del día) y `to` (inclusive, fin del día); si solo se define uno de los dos límites, el otro lado queda sin restricción (cubierto por test con fixtures de fechas límite).
- **CA-31** — `filterEvents` interpreta `priceRange` de forma inclusiva: un evento coincide si `event.price >= min` (cuando `min` no es `null`) y `event.price <= max` (cuando `max` no es `null`) (cubierto por test, incluyendo el caso de precio exactamente en el límite).
- **CA-32** — Existe una función pura (p. ej. `getPriceBounds(events: Event[]): { min: number; max: number }`) exportada desde `useEventFilters.ts`, que calcula el precio mínimo y máximo del array recibido; `EventsLandingPage.tsx` la usa para inicializar `priceBounds` de `SiteTopbar`. Cubierta por test, incluyendo el caso de array vacío.
- **CA-33** — `EventCategory` en `types.ts` queda ampliado con exactamente 3 valores nuevos — `"family"`, `"comedy"`, `"cinema"` — sumando 9 en total junto a los 6 existentes (`concert`, `theater`, `sports`, `festival`, `conference`, `exhibition`).
- **CA-34** — El mock data de `eventsService.ts` incluye al menos un evento para cada una de las 3 categorías nuevas, con `imageUrl` en `https://images.unsplash.com/...` (misma regla que CA-3); los invariantes ya exigidos (≥10 eventos totales, ≥1 evento por categoría, ≥3 `featured`) se siguen cumpliendo para el set completo de 9 categorías (`eventsService.test.ts` actualizado y en verde).
- **CA-35** — `CategoryFilter.tsx` deja de usar `Tabs`/`TabsTrigger`; cada categoría (incluyendo "Todos") se renderiza dentro de una `Card` de shadcn que contiene un ícono de `lucide-react` y su etiqueta; hacer clic en una tarjeta invoca `onValueChange` con el valor correcto, y la categoría activa se distingue mediante un atributo booleano aplicado de forma consistente (p. ej. `aria-pressed="true"`/`"false"`) — cubierto por test RTL, reemplazando las aserciones basadas en `role="tab"`. Cualquier otro test que dependa de ese rol (p. ej. `EventsLandingPage.test.tsx`) se actualiza en consecuencia.
- **CA-36** — El mapa `CATEGORY_LABELS` de `EventCard.tsx` sigue tipado como `Record<EventCategory, string>` e incluye una etiqueta en español para las 9 categorías (la ausencia de alguna es un error de compilación por exhaustividad del `Record`).
- **CA-37** — `npm run typecheck` y `npm run lint` pasan sin errores nuevos atribuibles a esta iteración.
- **CA-38** — `npm test` pasa incluyendo, como mínimo, los tests nuevos/actualizados enumerados en "Requisitos de testing" de esta sección (no queda ninguna referencia a `role="tab"` para selección de categoría, ni a `SiteHeader`).

## Inventario de reutilización

| Pieza | Decisión | Detalle |
| --- | --- | --- |
| `swiper` (`swiper/react`, módulos de `swiper/modules`) | INSTALAR (npm, no shadcn) | Dependencia nueva. **Prerrequisito bloqueante para el plan (no para la spec):** el usuario debe correr `npm install swiper` desde su propia terminal — Claude Code no puede instalar paquetes nuevos (`EALLOWSCRIPTS`). Reemplaza la decisión previa de la Iteración 1 de usar shadcn `Carousel` + `embla-carousel-react` para el hero; esa combinación queda descartada específicamente para este uso (`carousel` de shadcn ya instalado puede seguir existiendo en el proyecto si se usó en otro lugar, pero no se usa para el hero). |
| shadcn `calendar` | INSTALAR (shadcn) | `npx shadcn@latest add calendar`. **Prerrequisito:** el registro de este componente declara dependencias de `react-day-picker` y `date-fns`, ninguna instalada hoy. El usuario debe correr `npm install react-day-picker date-fns` desde su propia terminal antes de que el orquestador ejecute el `add` (mismo patrón `EALLOWSCRIPTS` que con `swiper`). |
| shadcn `popover` | INSTALAR (shadcn) | `npx shadcn@latest add popover`. Verificado en el registry: su única dependencia declarada es `cn` (ya presente como paquete npm en el proyecto); puede ejecutarse directamente desde Claude Code, sin prerrequisito de instalación adicional. |
| shadcn `slider` | INSTALAR (shadcn) | `npx shadcn@latest add slider`. Mismo caso que `popover`: única dependencia declarada es `cn`, sin instalación adicional requerida. |
| `Card`, `Badge`, `Button`, `Input`, `Sheet` | REUTILIZAR | Ya instalados en Iteración 1, en `src/components/ui/` |
| `cn()` | REUTILIZAR | `src/lib/utils.ts` |
| `formatCurrency` | REUTILIZAR | `src/lib/formatCurrency.ts`, para mostrar el rango de precio del `Slider` |
| Iconos de categoría | REUTILIZAR | `lucide-react`, ya instalado; no se necesita una librería de íconos nueva. Propuesta de mapeo (ajustable en implementación si algún nombre exacto no existiera en la versión instalada): `concert`→`Music`, `theater`→`Drama`, `sports`→`Trophy`, `festival`→`PartyPopper`, `conference`→`Presentation`, `exhibition`→`Palette`, `family`→`Baby`, `comedy`→`Laugh`, `cinema`→`Clapperboard`, `"all"`→`LayoutGrid` |
| `EventFilters`/`filterEvents` (`useEventFilters.ts`) | MODIFICAR (ya existe, no se crea de nuevo) | Se extiende con `dateRange`/`priceRange` y se añade `getPriceBounds`; no se reemplaza el archivo |
| `EventCategory`/`Event` (`types.ts`) | MODIFICAR | Se amplía el union con 3 valores nuevos |
| `eventsService.ts` | MODIFICAR | Mock data ampliada con eventos de las categorías nuevas |
| `CategoryFilter.tsx` | MODIFICAR | Reescritura interna: `Tabs` → `Card` + ícono |
| `EventCard.tsx` | MODIFICAR | `CATEGORY_LABELS` ampliado a 9 entradas |
| `EventsLandingPage.tsx` | MODIFICAR | Usa `SiteNavbar` + `SiteTopbar` + `FeaturedEventsHero`; posee el nuevo estado `dateRange`/`priceRange`; calcula `priceBounds` con `getPriceBounds` |
| `SiteHeader.tsx` / `SiteHeader.test.tsx` | ELIMINAR | Reemplazados por `SiteNavbar.tsx` y `SiteTopbar.tsx` (ver decisión de estructura más abajo) |
| `SiteNavbar.tsx` | CREAR | Nuevo componente; sin test dedicado obligatorio (ver Requisitos de testing) |
| `SiteTopbar.tsx` (+ test) | CREAR | Nuevo componente con estado controlado (búsqueda + fecha + precio) |
| `FeaturedEventsHero.tsx` | CREAR | Reemplaza al `FeaturedEventsCarousel.tsx` de la Iteración 1 (nunca llegó a construirse porque el carrusel quedó diferido); sin test dedicado obligatorio (ver Requisitos de testing) |
| `getPriceBounds` | CREAR | Función pura pequeña; se coloca en `useEventFilters.ts` junto a `filterEvents` (evita un archivo nuevo para una función trivial, DRY/KISS) |
| `DateRangeFilter`/`PriceRangeFilter` (tipos) | CREAR | Tipos inline/exportados desde `useEventFilters.ts`, junto a `EventFilters` (mismo patrón ya usado ahí, no van en `types.ts` porque son forma de filtro, no del dominio `Event`) |

**Decisión de estructura — Navbar/Topbar reemplazan a `SiteHeader` (no se reestructura internamente):** se opta por dos componentes nuevos en vez de reestructurar `SiteHeader.tsx` en dos franjas internas, porque (a) tienen responsabilidades y estado claramente distintos — navegación estática vs. controles de filtrado con estado —, (b) solo el topbar necesita ser `sticky`, lo que es más simple de expresar como el elemento raíz de un componente propio que como una sub-franja condicional dentro de uno más grande, y (c) sigue el mismo patrón de testing ya usado en el proyecto: lo puramente presentacional (navbar, como `SiteFooter`) no necesita test dedicado, y lo que tiene comportamiento real (topbar) sí. Ambos siguen residiendo en `src/components/layout/` (chrome de sitio sin conocimiento del dominio evento, mismo razonamiento documentado en la Iteración 1 para `SiteHeader`): reciben todo su estado por props (`searchValue/onSearchChange`, `dateRange/onDateRangeChange`, `priceRange/onPriceRangeChange`, `priceBounds`), sin importar tipos ni servicios de `modules/events`.

**Decisión de sticky:** solo `SiteTopbar` es `sticky top-0`; `SiteNavbar` permanece en flujo normal (no sticky). Justificación (KISS): apilar dos elementos sticky obligaría a calcular el alto del navbar para el `top` del topbar (offset dinámico) para evitar solapamientos; al dejar el navbar en flujo normal, cuando se hace scroll el navbar desaparece y el topbar queda pegado a `top: 0` sin superposición ni cálculo adicional. Esto cumple el pedido explícito del usuario ("el topbar debe quedar sticky") sin inventar un requisito no pedido (navbar sticky).

## Impacto en la estructura

Zona compartida / secuencial (antes de repartir trabajo en paralelo, por CLAUDE.md):

- Prerrequisitos de **usuario**, en su propia terminal, antes de cualquier instalación por el orquestador: `npm install swiper`, `npm install react-day-picker date-fns`.
- Instalaciones shadcn por el orquestador (serial, después de los `npm install` de arriba): `npx shadcn@latest add calendar`, `npx shadcn@latest add popover`, `npx shadcn@latest add slider`.
- `src/modules/events/types.ts` — contrato compartido (`EventCategory` ampliado); debe actualizarse antes o junto con las tareas que lo consumen (`eventsService.ts`, `CategoryFilter.tsx`, `EventCard.tsx`).
- `src/modules/events/hooks/useEventFilters.ts` — contrato compartido para las props de `SiteTopbar` y el estado de `EventsLandingPage`.

Archivos existentes modificados (con alcance):

- `src/modules/events/types.ts` — añade `"family" | "comedy" | "cinema"` a `EventCategory`.
- `src/modules/events/services/eventsService.ts` — añade eventos mock para las 3 categorías nuevas (imágenes Unsplash verificadas, mismo criterio que la Iteración 1).
- `src/modules/events/services/eventsService.test.ts` — actualiza la lista `ALL_CATEGORIES` a las 9 categorías.
- `src/modules/events/hooks/useEventFilters.ts` — añade `DateRangeFilter`/`PriceRangeFilter`, extiende `EventFilters`/`filterEvents`, añade `getPriceBounds`.
- `src/modules/events/hooks/useEventFilters.test.ts` — casos nuevos para fecha, precio y `getPriceBounds`.
- `src/modules/events/components/CategoryFilter.tsx` — reescritura interna (`Tabs` → `Card`+ícono), incluye las 3 categorías nuevas.
- `src/modules/events/components/CategoryFilter.test.tsx` — reescrito para los nuevos roles/atributos de selección.
- `src/modules/events/components/EventCard.tsx` — `CATEGORY_LABELS` con las 3 entradas nuevas.
- `src/modules/events/components/EventCard.test.tsx` — opcionalmente un caso adicional con una categoría nueva (recomendado, no obligatorio para cumplir CA-36, que es de compilación).
- `src/modules/events/components/EventsLandingPage.tsx` — usa `SiteNavbar`+`SiteTopbar` en vez de `SiteHeader`; usa `FeaturedEventsHero` en vez de la fila plana; añade estado `dateRange`/`priceRange` y `priceBounds` (vía `getPriceBounds`).
- `src/modules/events/components/EventsLandingPage.test.tsx` — actualizado para los nuevos roles de `CategoryFilter` y para el único input de búsqueda de `SiteTopbar` (ya no hay dos inputs duplicados, se ajusta de `getAllByPlaceholderText` a `getByPlaceholderText`).
- `src/modules/events/index.ts` — sin cambios de contrato obligatorios; no se prevé necesidad de exportar los nuevos componentes fuera del módulo.

Archivos nuevos:

```
src/modules/events/components/
  FeaturedEventsHero.tsx
src/components/layout/
  SiteNavbar.tsx
  SiteTopbar.tsx
  SiteTopbar.test.tsx
```

Archivos eliminados:

```
src/components/layout/SiteHeader.tsx
src/components/layout/SiteHeader.test.tsx
```

## Requisitos de testing

**Necesitan test nuevo o actualizado (Vitest + RTL):**

- `useEventFilters.test.ts` — casos nuevos: filtrado por `dateRange` (solo `from`, solo `to`, ambos, evento justo en el límite del día), filtrado por `priceRange` (límites inclusive), combinación de fecha+precio+texto+categoría con AND, y `getPriceBounds` (array con varios precios y el caso de array vacío). Es lógica pura, sin red.
- `CategoryFilter.test.tsx` — reescrito: clic en una `Card` de categoría invoca `onValueChange` con el valor correcto; la categoría activa expone el atributo booleano de estado; se renderizan las 9 categorías + "Todos".
- `SiteTopbar.test.tsx` — escribir en el input de búsqueda invoca `onSearchChange` (equivalente al test que hoy cubre `SiteHeader`); interactuar con el trigger de fecha y con el slider de precio invoca `onDateRangeChange`/`onPriceRangeChange` respectivamente (se testea la integración/wiring, no el comportamiento interno de `Popover`/`Calendar`/`Slider`, delegado a shadcn/su primitiva base — mismo criterio que Iteración 1 aplicó a `Sheet`).
- `eventsService.test.ts` — actualizado (`ALL_CATEGORIES` con 9 valores); sigue verificando los mismos invariantes (≥10 eventos, ≥1 por categoría, ≥3 destacados, todas las imágenes en `images.unsplash.com`).
- `EventsLandingPage.test.tsx` — actualizado para no depender de `role="tab"` (usa el nuevo contrato de `CategoryFilter`) ni de dos inputs de búsqueda duplicados (usa el input único de `SiteTopbar`); el flujo de búsqueda+categoría con AND que ya cubre debe seguir en verde.

**No necesitan test dedicado (con justificación):**

- `FeaturedEventsHero.tsx` — composición directa de `Swiper`/`SwiperSlide`; el comportamiento de swipe/navegación/paginación es responsabilidad de la librería (ya probada upstream), igual que el criterio aplicado a `Carousel`/Embla en la Iteración 1. `jsdom` tampoco implementa `ResizeObserver`, que Swiper usa internamente, lo que haría frágil cualquier test de comportamiento interno; un smoke test que verifique que renderiza sin lanzar excepción es opcional, no obligatorio.
- `SiteNavbar.tsx` — contenido y estructura estáticos (logo, links, trigger de `Sheet`), sin estado propio ni props condicionales relevantes — mismo razonamiento ya usado para `SiteFooter.tsx` en la Iteración 1.
- El comportamiento interno de `Popover`, `Calendar` y `Slider` de shadcn (apertura/cierre, navegación de meses, arrastre de manijas) — delegado a Radix/base-ui, ya probado upstream; solo se testea que `SiteTopbar` invoque los callbacks correctos ante una interacción (ver arriba).

## Riesgos y preguntas abiertas

- **Prerrequisitos de instalación (no bloqueantes para esta spec, sí secuenciales para el plan):** el usuario debe correr, desde su propia terminal, `npm install swiper` y `npm install react-day-picker date-fns` antes de que el orquestador pueda ejecutar `npx shadcn@latest add calendar`. `popover` y `slider` no requieren ningún `npm install` adicional (verificado contra el registry de shadcn) y pueden instalarse directamente por el orquestador. Recomendado: pedir ambos `npm install` como paso 0 del plan de esta iteración, igual que se hizo con `embla-carousel-react` en la Iteración 1 (que ahora queda sin efecto para el hero, ver Inventario).
- **Nombres exactos de íconos de `lucide-react`:** la propuesta de mapeo categoría→ícono se basa en el set estándar de la librería instalada (`lucide-react@^1.47.0`); si algún nombre exacto difiere en esa versión, el developer sustituye por el ícono equivalente más cercano disponible. No bloqueante, es un detalle de implementación ajustable sin impacto en la arquitectura ni en los criterios de aceptación (que no exigen un ícono específico por nombre).
- **Categorías nuevas propuestas** (`family`, `comedy`, `cinema`) buscan cubrir públicos habituales de una ticketera que las 6 categorías actuales no cubren bien (contenido infantil/familiar, stand-up/comedia, cine en vivo o funciones especiales); es una propuesta razonable y trivialmente ajustable (mock data + un union type), no bloqueante — ajustable en la aprobación humana igual que las categorías originales.
- **Rango de fechas/precios del mock data:** no bloqueante — `getPriceBounds` deriva los límites del precio dinámicamente del dataset (no se hardcodea un rango que dependa de una decisión de negocio), y la semántica de `dateRange` (CA-30) no depende de qué fechas concretas tenga el mock data.
- **Colores/estilo visual de los íconos de categoría ("llamativos")** son ajustables en la aprobación humana o en revisión posterior; no bloqueante, es un detalle de estilo dentro de una `Card` ya definida.

No se identifican puntos **BLOQUEANTES** reales para esta iteración: las únicas dependencias externas (`swiper`, `react-day-picker`, `date-fns`) están identificadas con su prerrequisito de instalación explícito, y las decisiones de diseño/mock data quedan resueltas de forma razonable y ajustable sin bloquear el arranque de la implementación una vez aprobado el spec.
