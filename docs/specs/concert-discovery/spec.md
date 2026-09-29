# Concert discovery redesign

Requested and implemented: September 28, 2026. Extends the approved landing redesign with the user's new visual references and real Peruvian concert listings.

## Delivered experience

- Dark, full-width concert hero with coral actions, photographic ambient background, and two opposing vertical image tracks. Repeated, identical groups form a seamless CSS loop without video or animation dependencies.
- Pause/resume control; operating-system reduced-motion preference stops the tracks. Decorative duplicates stay out of the accessibility tree.
- Editorial featured concerts and a chronological catalog. Search handles accents and matches artists, tours, venues, and cities; genre, city, month, event type, and favorites combine with AND.
- Favorites are scoped to the current visit. No account, remote storage, email subscription, payment, or invented inventory.
- Official purchase destinations in new tabs, native mobile menu, semantic headings, labeled controls, focus styles, skip link and responsive layouts.
- Server-rendered initial catalog; local images through Next Image. No fake network delay or additional runtime dependency.

## Reference synthesis

- [Ticketera](https://www.ticketera.com/): clear event-first hierarchy and ticket destinations.
- [Live Nation](https://www.livenation.lat/): prominent artist imagery and discovery by genre, place, and date.
- [Bandsintown](https://www.bandsintown.com/es): artist discovery and a personal selection.
- [Concerts50 Peru](https://concerts50.com/es/peru): destination-oriented chronological discovery.
- [StubHub event reference](https://www.stubhub.mx/bts-tickets-lima-estadio-universidad-nacional-mayor-de-san-marcos-7-10-2026/event/107154390/): prominence of date, venue and ticket actions. No resale availability or prices imported.

## Content provenance

The catalog is an editorial snapshot of [Teleticket's official listings](https://teleticket.com.pe/Conciertos), checked September 28, 2026. Each event stores its exact official URL, date, city, venue and verification date in `src/modules/events/services/eventsService.ts`. Displayed dates are date-only calendar dates: no showtimes are invented. Hombres G retains its October 29–30 range.

Promotional imagery was downloaded from Teleticket's CDN at `https://cdn.teleticket.com.pe/images/eventos/`:

| Local image | Official asset |
| --- | --- |
| zayn.jpg | liv031_calugalistado.jpg |
| mana.jpg | ven075_calugalistado.jpg |
| airbag.jpg | ven076_calugalistado.jpg |
| camilo.jpg | ven071v3_calugalistado.jpg |
| cultura.jpg | kiy043_calugalistado.jpg |
| hombres-g.jpg | csi019v3_calugalistado.jpg |
| festival.jpg | lmm009v4_calugalistado.jpg |
| camilo-arequipa.jpg | ven072v3_calugalistado.jpg |
| airbag-arequipa.jpg | lib012_calugalistado.jpg |
| hardwell.jpg | vas027_calugalistado.jpg |
| hayley.jpg | vel012_calugalistado.jpg |
| ca7riel.jpg | liv033_calugalistado.jpg |
| daniela.jpg | mrs003_calugalistado.jpg |
| kapo.jpg | jze007_calugalistado.jpg |
| zayn-hero.jpg | banners2/liv031_lg_1_2_banner.jpg |
| cultura-hero.jpg | banners2/kiy043_lg_1_2_banner.jpg |
| festival-hero.jpg | banners2/lmm009_lg_1_2_banner.jpg |

Images remain the property of their respective holders; the download is not a license grant. Confirm commercial usage rights before public launch. Listing dates and conditions must be maintained or connected to an authorized live feed. Prices stay null until a real pricing source is integrated; the UI directs visitors to the official seller.

## Release boundary

This is a functional front-end redesign, not an operational ticketing/payment platform. Serving thousands of visitors requires deployment/CDN setup, observability and load testing; capacity is not claimed by this change. A live catalog needs an authorized feed or an editorial maintenance process.

## Checks

TypeScript, ESLint, production build, existing regression tests plus concert catalog integrity, combined filters, empty-state recovery, official links, favorites and motion controls. Browser inspection covers the hero, catalog and mobile breakpoints.
