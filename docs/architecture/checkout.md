# Checkout: orden pendiente y reserva de inventario

Spec: `docs/specs/checkout/spec.md`. Módulo: `src/modules/checkout/` (`index.ts` cliente-seguro, `server.ts` handlers y SQL de disponibilidad).

## Qué hace y qué no

`POST /api/checkout` crea una orden `pending` con una reserva de cupo de 15 minutos. **No cobra, no emite entradas y no marca órdenes como `expired`** (tarjetas 04, 06 y 05). La UI lo dice explícitamente.

## Cupo

```
disponible = capacity − Σ reservas 'converted' − Σ reservas 'active' con expires_at > now()
```

Definido una sola vez en `availableUnitsSql` (`services/availability.ts`) y usado por la reserva y por el listado público (`PublicTicketOption.available`). Las reservas vencidas **dejan de contar por tiempo**, sin proceso en segundo plano; mientras no exista el barrido de la tarjeta 05 puede haber órdenes `pending` vencidas en la base, que el resumen muestra como vencidas.

Los fragmentos SQL deben usar nombres calificados (`ticket_type.id`, `tt.id`): Drizzle omite el prefijo de tabla en selects de una sola tabla y, dentro de subconsultas, el `id` sin calificar se resuelve contra la tabla equivocada.

## Reserva atómica (`services/createCheckout.ts`)

Una transacción: evento publicado → bloqueo `FOR UPDATE` de los tipos de entrada **en orden ascendente de id** (evita interbloqueos) → validación de ventana de venta, sesión futura y límite por pedido → **nueva consulta** de disponibilidad (en READ COMMITTED una sentencia nueva ve lo confirmado por quien tenía el bloqueo; la misma sentencia que bloquea no) → inserción de `order`, `order_item` e `inventory_reservation`. Cualquier fallo revierte todo. Precios y totales salen siempre de la base, en céntimos de PEN. `expires_at`/`created_at` usan el `now()` de la transacción, lo que satisface el `CHECK` de 15 minutos.

## Acceso a la orden

- Con sesión: el `user_id` sale de la sesión Clerk, nunca del cuerpo.
- Invitado: `POST` devuelve una sola vez un `accessToken` (32 bytes aleatorios); solo se guarda `sha256` en `order.access_token_hash` (migración `0009`, nullable y única). `GET /api/checkout/[orderId]` lo recibe en la cabecera `x-order-token`, lo compara en tiempo constante y responde `404` igual si la orden no existe o no se prueba acceso.
- El enlace de recuperación `/pedidos/<id>#t=<token>` guarda el token en el **fragmento**: no viaja al servidor, ni en `Referer`, ni en logs.

## Contrato

`POST /api/checkout` — cuerpo estricto `{ eventId (slug público), items[1..10]{ticketTypeId, quantity}, buyer{email,name} }`. `201` resumen; `400` datos; `403` origen/cuenta inactiva; `404` evento o tipo; `409` `sales_closed` o `insufficient_inventory` (con el cupo restante por línea); `503` genérico. Siempre `Cache-Control: private, no-store`.

## Verificación

- Tests de integración con PGlite (`createCheckout.test.ts`, `getCheckout.test.ts`) y de rutas/UI.
- **Concurrencia real:** `npm run verify:checkout` crea un esquema temporal con nombre único en PostgreSQL, reescribe `"public".` en las migraciones para que nada apunte a tablas reales, usa una conexión por comprador y borra el esquema al final. Resultado actual: 40 compradores por 10 unidades → exactamente 10 reservas; 30 órdenes con orden de tipos opuesto → 30 éxitos sin interbloqueo.
- Los pools de Neon en modo transacción no conservan `search_path`; el script usa el endpoint directo (mismo host sin `-pooler`) salvo que exista `DATABASE_URL_UNPOOLED`.

## Operación

`drizzle-kit migrate` **salió con código 1 sin mensaje** contra la URL con pooler y funcionó contra el endpoint directo. Para migrar, definir `DATABASE_URL_UNPOOLED` con el host sin `-pooler`. La migración `0009` es aditiva; un rollback de aplicación conserva la columna, que no requiere eliminarse.

## Límites conocidos

Sin tope de órdenes pendientes por correo/IP ni rate limiting (tarjeta 16): un tercero puede retener cupo repetidamente 15 minutos por vez. El `POST` no es idempotente ante doble envío (la idempotencia llega con el pago, tarjeta 04). `DemoEventPurchaseExperience` sigue en eventos sin `ticketOptions` (tarjeta 14). Las copias de verificación de `Origin` en `staffApi` y `eventManagement` no se unificaron con `src/lib/sameOrigin.ts` (tarjeta 16).
