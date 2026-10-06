# Spec — Checkout: orden pendiente y reserva de inventario (15 min)

> **Estado:** APROBADO
> **Aprobado por:** Usuario (ronaldreyesramirez@gmail.com), 2026-10-05, con las decisiones de §10.
> **Solicitado por:** Usuario (ronaldreyesramirez@gmail.com), 2026-10-05 — tarjeta Trello «03 · Checkout».
> **Base aprobada:** `docs/specs/ticketing-system-design/spec.md` (APROBADO 2026-10-05, §6.2 y §9.1). Este spec solo concreta la primera entrega del checkout; no reabre esas decisiones.

## 1. Objetivo

Permitir que un comprador (invitado o con sesión) elija entradas de un evento publicado y que el servidor cree una **orden `pending`** con una **reserva de cupo de 15 minutos**, garantizando que bajo compras simultáneas **nunca se reserve más cupo del existente**. La entrega termina cuando la orden y la reserva existen y el comprador ve su resumen con cuenta regresiva. **El cobro no forma parte de esta entrega** (tarjeta 04).

## 2. Alcance

### Incluido

- Servicio servidor `createCheckout` en un módulo nuevo `src/modules/checkout/`: valida, calcula precios y, en **una transacción PostgreSQL**, bloquea el cupo, crea `order`, `order_item` e `inventory_reservation`.
- Cálculo de disponibilidad por tipo de entrada, compartido con la vista pública (el cliente ve «quedan N»).
- Ruta fina `POST /api/checkout` y consulta `GET /api/checkout/[orderId]` del resumen (orden + reserva + tiempo restante).
- UI real de compra en el detalle del evento (`/eventos/[eventId]`): selección de cantidad por tipo de entrada, datos del comprador y resumen con cuenta regresiva. Sustituye el texto «La compra de entradas aún no está habilitada» de `ConfiguredEventPage`.
- Compra como **invitado** (correo y nombre obligatorios) o **autenticado** (se asocia `user_id` desde la sesión Clerk, nunca desde el cuerpo de la petición).
- Tests unitarios, de integración (PGlite) y verificación de concurrencia (ver §7).

### Fuera de alcance (otras tarjetas)

- Cobro, Checkout Session/PaymentIntent, webhooks de pago y paso de la orden a `paid` → **04**.
- Barrido que marca `expired` las órdenes vencidas y libera/concilia con Stripe → **05**. En esta entrega las reservas vencidas simplemente **dejan de contar** para el cupo (cálculo por tiempo), sin necesidad de un proceso en segundo plano.
- Emisión de tickets/QR y correo → **06**. «Mis entradas» → **07**. Vinculación de órdenes de invitado → **07**.
- Promociones y códigos → **10** (`discount_cents` se guarda en 0, sin `order_promotion`).
- Reembolsos y devolución de cupo → **09** (ver supuesto en §4.5).
- Cargos de servicio y comisiones: **no existen** (decisión §9.1). El total es la suma de precios de entrada.
- Asignación de asiento: no existe; se compran unidades de un tipo de entrada con cupo (§9.1).

## 3. Reglas de negocio

1. **Evento comprable:** el evento está `published` y al menos una de sus sesiones aún no ha terminado (`ends_at > now()`).
2. **Tipo de entrada comprable:** pertenece al evento, `salesStartAt <= now() < salesEndAt` (el servidor decide con su reloj, no el cliente) y cubre al menos una sesión futura.
3. **Cantidad por línea:** entero `>= 1` y `<= ticket_type.max_per_order` (límite configurable por tipo; **no hay tope global**, §9.1). Una orden contiene entre 1 y 10 líneas, una por tipo de entrada distinto (sin duplicados).
4. **Precio:** siempre el `price_cents` vigente en base de datos, congelado en `order_item.unit_price_cents`. El cliente no envía precios ni totales. Todo en céntimos enteros de PEN (`currency = 'pen'`).
5. **Totales:** `subtotal = Σ quantity × unit_price`, `discount = 0`, `total = subtotal`. Debe satisfacer los `CHECK` existentes de `order` y `order_item`.
6. **Unidades:** la cantidad es de unidades del tipo de entrada. Para `box`, una unidad es un espacio que admite `people_per_unit` personas; el cupo se descuenta por unidad, no por persona.
7. **Comprador:** `buyerEmail` válido, normalizado (trim + minúsculas, sin quitar puntos ni sufijos `+`), `buyerName` 1–100 caracteres. Con sesión activa se guarda `user_id` de la sesión; sin sesión, `user_id = NULL`. Una cuenta inactiva/suspendida no puede comprar.
8. **Datos de asistentes:** opcionales y fuera de esta entrega (se piden al emitir tickets).

## 4. Cupo y reservas

### 4.1 Disponibilidad

Para un tipo de entrada `T`:

```
disponible(T) = capacity(T)
              − Σ quantity de reservas de T con status = 'converted'
              − Σ quantity de reservas de T con status = 'active' y expires_at > now()
```

Las reservas `released` y las `active` ya vencidas no cuentan. Los tickets emitidos no se suman aparte: una unidad vendida corresponde a una reserva `converted` (no se cuenta dos veces).

### 4.2 Reserva atómica

Dentro de una única transacción:

1. Bloquear con `SELECT … FOR UPDATE` las filas `ticket_type` solicitadas, **siempre en orden ascendente de `id`** (evita interbloqueos entre órdenes con varias líneas).
2. Releer disponibilidad **después** de bloquear.
3. Si alguna línea excede la disponibilidad → abortar toda la transacción sin escribir nada, y responder `409` indicando qué tipo de entrada y cuántas unidades quedan.
4. Insertar `order` (`pending`), `order_item` y `inventory_reservation` (`active`, `expires_at = created_at + 15 min`; ya impuesto por el `CHECK` de la tabla).

El servidor **no** confía en `available` mostrado en la UI; es solo informativo.

### 4.3 Vencimiento

La reserva dura 15 minutos desde su creación. Pasado ese tiempo deja de contar (§4.1). Esta entrega **no** cambia el estado de la orden a `expired` (lo hará 05); el resumen la muestra como vencida según `expires_at`.

### 4.4 Sin cobro aún

Hasta la tarjeta 04, el resumen muestra la orden pendiente y la cuenta regresiva, y **no ofrece un botón de pago funcional**: debe indicar con claridad que el pago aún no está habilitado. No se simulan pagos ni se emiten entradas.

### 4.5 Supuesto sobre reembolsos

El cupo liberado por un reembolso se devolverá a la venta (decisión §9.1) cambiando el estado de la reserva correspondiente (p. ej. `converted → released`) en la tarjeta 09. La fórmula de §4.1 ya lo soporta sin cambios.

## 5. Contrato de API

### `POST /api/checkout`

Cuerpo JSON estricto (`zod.strict()`):

```json
{
  "eventId": "<uuid>",
  "items": [{ "ticketTypeId": "<uuid>", "quantity": 2 }],
  "buyer": { "email": "ana@example.com", "name": "Ana Pérez" }
}
```

| Caso | Respuesta |
| --- | --- |
| Éxito | `201` con `{ orderId, status: "pending", totalCents, currency, expiresAt, items:[{ticketTypeId,name,quantity,unitPriceCents,totalCents}] }` |
| JSON inválido / campos extra / valores fuera de rango | `400` |
| `Origin` ausente o distinto al del sitio | `403` |
| Cuenta con sesión pero inactiva | `403` |
| Evento o tipo de entrada inexistente, no publicado o ajeno al evento | `404` |
| Fuera de la ventana de venta o sin sesión futura | `409` con código `sales_closed` |
| Cupo insuficiente | `409` con código `insufficient_inventory` y el cupo restante por línea |
| Base de datos no disponible | `503`, sin filtrar detalles internos |

Cabeceras: `Cache-Control: private, no-store`. La petición no puede fijar `userId`, precios, totales, estado ni expiración.

### `GET /api/checkout/[orderId]`

Devuelve el resumen de una orden pendiente propia. **Control de acceso:** el `orderId` es un UUID, pero no es suficiente por sí solo para datos de comprador. Para invitados se entrega un **token de acceso opaco** (secreto aleatorio, guardado solo como hash en `order.access_token_hash`) devuelto una vez en el `POST` (campo `accessToken`, solo para órdenes de invitado) y presentado como cabecera o en el fragmento de la URL de resumen, nunca en query string; para autenticados basta la sesión del propietario (§10, P1).

## 6. Criterios de aceptación (verificables)

**Creación de la orden**

- **CA-01** Dado un evento publicado, un tipo de entrada en venta y cupo suficiente, `POST /api/checkout` crea exactamente una `order` `pending`, una `order_item` por línea y una `inventory_reservation` `active` por línea con `expires_at = created_at + 15 min`.
- **CA-02** `unit_price_cents`, `total_cents`, `subtotal_cents` y `total_cents` de la orden se calculan en servidor a partir de `ticket_type.price_cents`; ningún precio ni total del cuerpo de la petición se usa (el esquema estricto rechaza esos campos).
- **CA-03** Con sesión Clerk activa, `order.user_id` es el usuario de la sesión; sin sesión es `NULL`. Un cuerpo que intente enviar `userId` es rechazado con `400`.
- **CA-04** El correo se guarda normalizado (trim, minúsculas) conservando puntos y sufijos `+`.

**Validaciones de venta**

- **CA-05** Se rechaza con `404` un evento no `published`, un tipo de entrada inexistente o que pertenece a otro evento.
- **CA-06** Se rechaza con `409 sales_closed` un tipo fuera de su ventana de venta o de un evento sin sesiones futuras, usando el reloj del servidor.
- **CA-07** Se rechaza con `400` una cantidad `< 1`, no entera, o mayor que `max_per_order` de ese tipo; líneas duplicadas del mismo tipo; más de 10 líneas; o una orden sin líneas.
- **CA-08** Una cuenta inactiva con sesión recibe `403`. Un `Origin` ausente o ajeno recibe `403` y no se escribe nada.

**Cupo y concurrencia (sin sobreventa)**

- **CA-09** La disponibilidad de §4.1 cuenta reservas `converted` y `active` no vencidas; no cuenta `released` ni `active` vencidas.
- **CA-10** Si una línea excede la disponibilidad, la transacción completa se revierte: no queda ninguna `order`, `order_item` ni reserva de esa petición (ni de sus otras líneas), y la respuesta es `409 insufficient_inventory` con el cupo restante.
- **CA-11** Con cupo `C` y `N > C` compradores pidiendo 1 unidad en paralelo, exactamente `C` tienen éxito y `N − C` reciben `409`; la suma de reservas vigentes nunca supera `capacity`.
- **CA-12** Dos órdenes simultáneas que piden los mismos tipos en distinto orden no producen interbloqueo (bloqueo en orden de `id`).
- **CA-13** Tras el vencimiento (`expires_at <= now()`), el cupo vuelve a estar disponible para nuevas compras sin intervención de ningún proceso.
- **CA-14** El cupo mostrado en el detalle del evento («quedan N») coincide con la fórmula de §4.1 y se calcula con la misma función que usa la reserva.

**Resumen y UI**

- **CA-15** El detalle del evento permite elegir cantidades por tipo respetando mínimos/máximos y cupo mostrado, ingresar nombre y correo, y enviar. Muestra errores del servidor sin perder lo ingresado.
- **CA-16** Tras crear la orden se muestra un resumen con líneas, total en PEN, cuenta regresiva hasta `expires_at` y estado «vencida» al llegar a cero.
- **CA-17** El resumen indica explícitamente que **el pago aún no está disponible**; no hay botón de pago activo, no se emiten entradas ni QR.
- **CA-18** `GET /api/checkout/[orderId]` solo devuelve la orden al propietario (sesión) o a quien presente el token de invitado válido (comparación en tiempo constante contra `access_token_hash`); en otro caso responde `404` sin revelar si la orden existe. El token en claro solo se devuelve en la respuesta del `POST` y nunca se persiste.
- **CA-19** Los tipos de entrada sin cupo o fuera de venta se muestran deshabilitados con la razón («Agotado», «Venta cerrada»).
- **CA-20** La UI es accesible: controles etiquetados, cantidad operable por teclado, estados de error anunciados, cuenta regresiva sin anuncios por segundo (`aria-live` limitado) y layout móvil sin scroll horizontal.

**Calidad**

- **CA-21** `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.
- **CA-22** Ningún secreto ni dato personal del comprador aparece en logs, respuestas de error ni URLs (el correo no viaja en query strings).

## 7. Requisitos de testing

- **Unitarios:** esquema `zod` (rangos, `strict`, normalización de correo), cálculo de totales, función de disponibilidad.
- **Integración (PGlite, patrón de `webhookInbox`/`identityStore`):** CA-01 a CA-10, CA-13, CA-14, CA-18; incluye reversión completa en multi-línea (CA-10).
- **Concurrencia (CA-11, CA-12):** PGlite usa una sola conexión y **no demuestra concurrencia real**. Debe añadirse un script de verificación (estilo `scripts/verify-webhook.mjs`) que lance `N` transacciones simultáneas con conexiones independientes dentro de un **esquema temporal aislado** del PostgreSQL de desarrollo (§10 P3), nunca contra datos reales, y reporte resultados. Si el esquema temporal no puede crearse, el reviewer debe consignar la limitación y no declarar CA-11/CA-12 verificados.
- **Componentes (React Testing Library):** CA-15 a CA-17, CA-19, CA-20; pruebas de la cuenta regresiva con timers falsos.
- **Rutas:** `403` por origen, `400` por cuerpo, `503` ante fallo de BD, cabeceras `no-store`.

## 8. Inventario de reutilización

| Necesidad | Existente a reutilizar | Nuevo |
| --- | --- | --- |
| Acceso a BD y tablas | `src/lib/db` (`orders`, `orderItems`, `inventoryReservations`, `ticketTypes`, `ticketTypeSessions`, `eventSessions`, `events`) — una **migración aditiva** (`order.access_token_hash`, §10 P1) | migración 0009 |
| Sesión y cuenta activa | `getCurrentAccessUser`, `AccessError` vía barrel `@/modules/identity-access` | — |
| Validación | `zod` ya instalado | esquemas del checkout |
| Verificación de `Origin` | patrón `checkOrigin` presente en `staffApi` (y posiblemente `eventManagement`) | **Revisar duplicados antes de crear otro**: extraer a `src/lib/` si hay ≥ 2 copias (DRY) |
| Formato de dinero y fechas | `src/lib/formatCurrency.ts`, `src/lib/formatEventDate.ts` (la UI actual repite `money`/`when` locales: reutilizar los compartidos) | — |
| UI | shadcn existentes: `Button`, `Input`, `Card`, `Badge`, `Skeleton` | Instalar con `npx shadcn@latest add` solo si falta algo (p. ej. `label`/`alert`); nunca a mano |
| Datos del evento y tipos | `PublicTicketOption` y `listDatabaseEvents` en `events` | Añadir `available` y estado de venta a `PublicTicketOption` |
| Formato de handlers | patrón `handleX(request)` de `staffApi`/`stripeWebhook`, ruta delgada en `src/app/api/` | `handleCreateCheckout`, `handleGetCheckout` |
| Estructura | `docs/SETUP.md`: `src/modules/checkout/{components,hooks,services,types.ts,index.ts}` | módulo `checkout` |

El detalle de evento sigue en el módulo `events`; consume `checkout` solo a través de su barrel `index.ts`. El prototipo `DemoEventPurchaseExperience` (zonas ficticias para eventos sin `ticketOptions`) **no se toca** en esta entrega; su retiro corresponde a la tarjeta 14.

## 9. Riesgos y notas

- **Abuso de reservas:** un tercero puede reservar todo el cupo repetidamente sin pagar (cada reserva dura 15 min). Mitigaciones previstas: límite por cantidad (`max_per_order`), orígenes validados; **límite de frecuencia y tope de órdenes pendientes por correo/IP quedan para la tarjeta 16** salvo que se decida otra cosa (P2).
- **Doble envío:** un doble clic crearía dos órdenes. La UI deshabilita el botón durante el envío; la idempotencia fuerte del cobro llega con 04 (`payment.idempotency_key`). No se promete idempotencia del `POST` en esta entrega.
- **Reloj:** toda decisión temporal usa `now()` del servidor/BD.
- **Vencimiento sin barrido:** hasta 05, hay órdenes `pending` ya vencidas en BD; el resumen y el cupo las tratan como vencidas por tiempo. Debe documentarse en `docs/architecture/`.
- **Conteo de `converted`:** no existe aún quien convierta reservas (lo hará 04). En esta entrega la rama `converted` de §4.1 se prueba insertando datos de prueba.

## 10. Decisiones resueltas (2026-10-05)

- **P1 — Acceso de invitados al resumen:** token opaco con **migración aditiva**. Se añade `access_token_hash` (nullable, único) a `order`; el `POST` devuelve el token en claro **una sola vez** (secreto aleatorio de ≥ 128 bits) y solo se guarda su hash. El resumen de invitado se consulta con ese token; el de un usuario autenticado, con su sesión. La migración no destruye datos, conserva las filas existentes y se aplica solo tras verificar que el objetivo no tiene conflictos (nunca `push`/reset). El token no aparece en logs.
- **P2 — Tope de órdenes pendientes:** **diferido a la tarjeta 16** (junto con rate limiting). No se implementa ningún tope por correo en esta entrega.
- **P3 — Concurrencia real:** el script de verificación crea y elimina un **esquema temporal aislado** en el PostgreSQL de desarrollo configurado (`DATABASE_URL`), con nombre único, aplicando el esquema necesario dentro de él; no lee ni modifica tablas reales, y se limpia incluso si falla. Debe abortar si el esquema temporal no puede crearse. Las credenciales no se imprimen.

## 11. Entregables

`docs/specs/checkout/plan.md` (tras aprobar este spec), implementación en `src/modules/checkout/` y rutas delgadas, `docs/architecture/checkout.md` (reglas de cupo, vencimiento sin barrido, contrato de API) y `docs/specs/checkout/review.md` del reviewer.
