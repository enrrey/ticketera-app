# Plan — Checkout: orden pendiente y reserva de inventario

Spec: `docs/specs/checkout/spec.md` (APROBADO 2026-10-05). Implementación en una sola sesión, secuencial (tareas con archivos compartidos: schema, barrels, listado de eventos).

## Decisiones de implementación

- `eventId` del `POST` es el **identificador público del evento (slug)**, el mismo `id` que exponen los listados; los tipos de entrada se identifican por UUID. Aclaración del spec, no cambia alcance.
- `inventory_reservation.expires_at` y `created_at` usan sus defaults en la misma transacción (`now()` idéntico), lo que satisface el `CHECK` de 15 minutos.
- La disponibilidad vive en **un solo fragmento SQL** (`availableUnitsSql`) que usan la reserva y el listado público (CA-14).
- Módulo `src/modules/checkout/`: `index.ts` (cliente seguro: componentes/tipos) y `server.ts` (handlers y servicios; importan `pg`).
- Helper compartido `src/lib/sameOrigin.ts` para la verificación de `Origin`. Las copias previas en `staffApi` y `eventManagement` no se tocan aquí (limpieza → tarjeta 16).
- Token de invitado: 32 bytes aleatorios (`base64url`), se guarda `sha256` hex en `order.access_token_hash` (migración 0009, nullable, único); comparación en tiempo constante.

## Tareas

- [ ] **T1 Migración y base:** `order.access_token_hash`, generar `0009`, helper `sameOrigin` + tests. Probar la migración en PGlite; aplicarla a la BD solo al final, tras verificar que no hay conflicto.
- [ ] **T2 Servicios:** `checkoutSchema` (zod estricto), `availability`, `createCheckout` (transacción con `FOR UPDATE` ordenado), `getCheckout`. Tests PGlite: CA-01…CA-10, CA-13, CA-14, CA-18.
- [ ] **T3 Handlers y rutas:** `handleCreateCheckout`, `handleGetCheckout`, `src/app/api/checkout/route.ts` y `[orderId]/route.ts`. Tests: origen, cuerpo, 503, `no-store`, sesión inactiva.
- [ ] **T4 Listado público:** `PublicTicketOption.available` calculado con `availableUnitsSql`.
- [ ] **T5 UI:** `TicketCheckout` (selección, datos, errores, resumen con cuenta regresiva), página `/pedidos/[orderId]` (token en el fragmento de la URL), integración en `ConfiguredEventPage`. Tests RTL: CA-15…CA-17, CA-19, CA-20.
- [ ] **T6 Concurrencia real:** `scripts/verify-checkout-concurrency.mjs` en esquema temporal aislado; CA-11 y CA-12.
- [ ] **T7 Cierre:** `docs/architecture/checkout.md`, `typecheck`, `lint`, `test`, `build`, migración aplicada, reviewer independiente (`review.md`).

## Verificación

`npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=1`, `npm run build`, `node scripts/verify-checkout-concurrency.mjs`.
