# Spec — Pagos Stripe y procesamiento del inbox de webhooks

> **Estado:** IMPLEMENTADO Y VERIFICADO — entorno de prueba
> **Autorización de ejecución:** usuario, «sigue con las demas tareas»; continuidad del diseño de Ticketera aprobado.
> **Fecha:** 2026-10-07
>
> El plan y las decisiones concretas de esta ejecución están en `plan.md`; la configuración, compatibilidad y límites están en `setup.md`. Las preguntas del borrador al final se conservan como contexto histórico y quedan resueltas por esos documentos. El alcance se amplió con vencimiento seguro (tarjeta 05) y comprobante Invoicing postpago, pedidos en la conversación.

Fuente: tarjeta Trello 04 (la petición se recibió en texto; no se leyó la tarjeta). Decisiones del diseño: `docs/specs/ticketing-system-design/spec.md` §3 (confirmadas: Pago, Pago tardío, Seguridad de datos), §6.2 (flujo y nota de compatibilidad Checkout `expires_at`), §8 (webhooks idempotentes, reintentos controlados, sin PAN/CVV). Contexto: `docs/specs/checkout/spec.md` (orden `pending` + reserva 15 min, ya implementado en d572c53).

## Objetivo
Cobrar una orden `pending` mediante Stripe iniciado desde el servidor con clave idempotente, y confirmar el pago procesando el inbox `webhook_event` exactamente una vez por evento, de modo que un pago dentro del plazo deje la orden `paid` y la reserva convertida en venta.

## Alcance
### Dentro
- Endpoint servidor que crea el cobro Stripe para una orden `pending` propia (sesión o token de invitado) y registra una fila `payment` con `idempotency_key`.
- Procesador del inbox: toma `webhook_event` `provider='stripe'` en `pending`, consulta el objeto canónico en Stripe, aplica efectos, marca `processed`/`failed`, incrementa `attempts`.
- Transición pago a tiempo: `payment.succeeded`, `order.paid`, `inventory_reservation.converted`, más gancho (función inyectable, no-op por defecto) para emisión de tickets.
- Pago tras vencer la reserva: comportamiento según §Preguntas abiertas P3 (propuesta: reembolso automático, sin tickets, sin pasar a `paid`).
- Pago fallido/cancelado: `payment` `failed`/`cancelled`; la orden sigue `pending` mientras la reserva esté vigente.
- Páginas de resultado: éxito, cancelado y fallido.
- Variables de entorno/documentación de configuración necesarias.

### Fuera de alcance
- Emisión de tickets/QR y correo (tarjeta 06); solo se deja el gancho.
- Barrido que marca órdenes `expired`, libera reservas y expira la Checkout Session al minuto 15 (tarjeta 05).
- Reembolsos manuales/por ticket, cancelación de evento (el reembolso automático por pago tardío es lo único que toca `refund`, si se aprueba P3).
- Stripe Connect/liquidaciones, promociones nuevas. Invoicing postpago se incluye en esta ejecución por el alcance solicitado en la conversación.
- Procesamiento de eventos `provider='clerk'`.
- Sin PAN/CVV: ningún campo de tarjeta en la app (restricción, no funcionalidad).

## Criterios de aceptación
Supuestos entre corchetes dependen de la respuesta a las preguntas abiertas indicadas.

**Creación del pago**
- **CA-1** — `POST /api/checkout/[orderId]/payment` sobre una orden `pending` con reserva vigente, del propietario o con token de invitado válido, crea exactamente una fila `payment` (`status='pending'`, `amount_cents = order.total_cents`, `currency='pen'`, `idempotency_key` no nulo) y devuelve la URL de Stripe a la que redirigir [P1]. Importe y moneda salen de la BD, nunca del cuerpo de la petición.
- **CA-2** — Dos llamadas consecutivas para la misma orden no crean un segundo `payment` activo ni un segundo objeto Stripe: se reutiliza el existente (misma `idempotency_key`, derivada de forma determinista de la orden e intento) y se pasa como `Idempotency-Key` a Stripe.
- **CA-3** — Sin sesión ni token válido, o con orden inexistente, responde `404` sin revelar la existencia (mismo criterio que CA-18 de checkout). Orden no `pending` o con reserva vencida responde `409` y no llama a Stripe.
- **CA-4** — La Checkout Session se crea con `expires_at` ≥ 30 min desde la creación [P1], `metadata`/`client_reference_id` con el id de la orden, URLs de éxito y cancelado a las páginas de resultado, y sin que el servidor reciba ni guarde datos de tarjeta. La clave secreta solo se usa en servidor.
- **CA-5** — Si `STRIPE_SECRET_KEY` no está configurada, el endpoint responde `503` sin crear `payment`. Si Stripe falla, no queda una fila `payment` huérfana con estado distinto de `pending`/`failed` y la respuesta es un error genérico sin detalles internos.

**Procesador del inbox**
- **CA-6** — El procesador selecciona solo eventos `provider='stripe'` y `status='pending'` (y reintentables, ver CA-11), los reclama de forma atómica (`pending`→`processing`, p. ej. `FOR UPDATE SKIP LOCKED`) de modo que dos ejecuciones concurrentes no procesen el mismo evento.
- **CA-7** — Al reclamar un evento se incrementa `attempts` en 1; al terminar bien queda `status='processed'` y `processed_at` informado.
- **CA-8** — Un mismo `external_event_id` produce sus efectos como máximo una vez: reprocesar un evento ya `processed`, o dos eventos distintos sobre el mismo pago, deja `order`, `payment` e `inventory_reservation` en el mismo estado que tras la primera aplicación (idempotente por estado, sin duplicar filas).
- **CA-9** — Los datos del pago se obtienen consultando a Stripe por `object_id` (el inbox no guarda payload); el procesador no confía en importes ni estados del cuerpo original del webhook. Importe o moneda de Stripe distintos de `payment.amount_cents`/`currency` NO marcan la orden `paid`: el evento queda `failed` y se registra en `audit_log`.
- **CA-10** — Evento de tipo no manejado: se marca `processed` sin efectos (no se reintenta).
- **CA-11** — Fallo transitorio (red, Stripe 5xx, error de BD): el evento vuelve a `pending` con `attempts` incrementado y no se reprocesa antes de la espera definida [P4]. Al alcanzar el máximo de intentos [P4] queda `failed` y se registra en `audit_log`; nunca se reintenta indefinidamente.
- **CA-12** — Un evento `failed` o con error no bloquea el procesamiento de los demás.

**Efectos de negocio**
- **CA-13** — Pago confirmado (`checkout.session.completed` con `payment_status='paid'` / `payment_intent.succeeded` [P1]) con `payment.paid_at ≤ reservation.expires_at`: en una sola transacción `payment` pasa a `succeeded` con `paid_at`, `stripe_payment_intent_id`/`stripe_charge_id` guardados, `order` a `paid` y todas sus reservas `active` a `converted`; luego se invoca el gancho de emisión de tickets una vez.
- **CA-14** — El gancho es una dependencia inyectable con implementación por defecto sin efectos; un test demuestra que se llama exactamente una vez por orden pagada aunque el evento se reprocese.
- **CA-15** — Pago confirmado con `paid_at > expires_at` de la reserva [P3]: la orden NO pasa a `paid`, las reservas no se convierten, no se invoca el gancho de tickets, `payment` queda registrado y se crea un `refund` con `idempotency_key` determinista y la llamada de reembolso a Stripe. La diferencia se decide por el tiempo de finalización del cobro en Stripe, no por la hora de recepción del webhook (un webhook entregado tarde de un pago a tiempo sigue siendo CA-13).
- **CA-16** — Pago fallido (`payment_intent.payment_failed`) o sesión expirada/cancelada sin pago: `payment` pasa a `failed`/`cancelled`; `order` permanece `pending`; reservas sin cambios. Un evento de fallo posterior a un `succeeded` no degrada el estado.
- **CA-17** — Un evento fuera de orden (p. ej. fallo recibido después de éxito) no retrocede estados: las transiciones solo avanzan según el orden `pending → processing → succeeded|failed|cancelled`.

**Disparo del procesador**
- **CA-18** — El procesador se dispara por [P5]; el punto de entrada protegido no puede ser invocado por clientes anónimos (secreto compartido/cabecera de scheduler o rol administrador) y responde `401/403` sin él.
- **CA-19** — `handleStripeWebhook` sigue solo persistiendo y respondiendo `200`; no ejecuta efectos de negocio (comportamiento actual intacto; su test existente sigue pasando).

**Interfaz**
- **CA-20** — Existe una ruta de éxito (`/pedidos/[orderId]/pago/exito`) y una de cancelado (`.../cancelado`) [nombres sujetos a P6]. La de éxito NO afirma que el pago está confirmado hasta que la orden figure `paid` según el servidor: muestra «procesando» mientras siga `pending` y vuelve a consultar con intervalo acotado, y muestra confirmado cuando `paid`.
- **CA-21** — La vista de la orden (`OrderPage`/`OrderSummary`) ofrece el botón «Pagar» solo con estado `pending` y reserva vigente; al pulsarlo llama al endpoint de CA-1 y redirige; muestra error accesible (`role="alert"`) si falla; el botón se deshabilita mientras la petición está en curso.
- **CA-22** — Cancelado y pago fallido muestran mensaje claro y un enlace para reintentar el pago mientras la reserva siga vigente; si ya venció, indican que el cupo se liberó y enlazan al evento.
- **CA-23** — Un pago tardío reembolsado (CA-15) se muestra al comprador como «el pago llegó fuera de plazo y será reembolsado»; no como pedido pagado.
- **CA-24** — Ningún archivo de `src/` define campos ni almacena PAN/CVV/expiración de tarjeta; el pago ocurre en la página alojada de Stripe [P1].

**Estructura**
- **CA-25** — Las rutas en `src/app/` solo delegan en handlers exportados por los barrels de `payments` (y de `checkout` si procede); la lógica vive en `src/modules/payments/`. `npm run typecheck`, `npm run lint` y `npm test` pasan.

## Inventario de reutilización
| Pieza | Decisión | Detalle |
| --- | --- | --- |
| Verificación de firma + persistencia en inbox | REUTILIZAR | `src/modules/payments/services/stripeWebhook.ts`, `webhookInbox.ts`; ruta `src/app/api/webhooks/stripe/route.ts` |
| SDK `stripe` | REUTILIZAR | Ya importado en `stripeWebhook.ts` |
| Tablas `payment`, `webhook_event`, `refund`, `order`, `inventory_reservation`, `audit_log` | REUTILIZAR | `src/lib/db/schema.ts`; `payment.idempotency_key` único y `webhook_event.attempts` ya existen, probable sin migración (revisar si P4 exige `next_attempt_at`/`last_error`) |
| Acceso a BD / tipo de transacción | REUTILIZAR | `getDatabase` de `@/lib/db`; patrón `PgDatabase` inyectable de `webhookInbox.ts` |
| Autorización de orden (propietario o token invitado, comparación en tiempo constante) | REUTILIZAR | `src/modules/checkout/services/accessToken.ts`, `getCheckout.ts`; exponer lo necesario vía `checkout/server.ts` |
| Patrón `handleX(request)` + ruta delgada | REUTILIZAR | `checkoutApi.ts`, `src/app/api/checkout/` |
| Cliente fetch, hooks de tiempo, resumen de orden | REUTILIZAR | `checkoutClient.ts`, `useCountdown.ts`, `useClientNow.ts`, `OrderPage.tsx`, `OrderSummary.tsx` |
| Harness de BD para tests | REUTILIZAR | `src/modules/checkout/services/testDatabase.ts` (si no se exporta, moverlo a un lugar compartido en vez de duplicarlo) |
| Botón, tarjeta, badge | REUTILIZAR | `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx` |
| Alertas/mensajes de resultado | INSTALAR (opcional) | shadcn `alert`, si no se prefiere `role="alert"` con `<p>` como en `OrderPage` |
| `createPayment` (Checkout Session/PaymentIntent + fila `payment`) | CREAR | No existe nada equivalente (búsqueda en `modules/*` y `lib/`) |
| `processWebhookInbox` / `processStripeEvent` / reclamo atómico | CREAR | El inbox solo recibe; no hay worker |
| `fulfillOrder` (transacción pagada/convertida) y `handleLatePayment` | CREAR | Sin equivalente |
| Gancho de emisión de tickets | CREAR | Interfaz mínima; implementación real en tarjeta 06 |
| Endpoint protegido de disparo | CREAR | Según P5 |
| Páginas `PaymentResult` (éxito/cancelado/fallido) y `PayButton` | CREAR | Específicas de `payments`; sin equivalente |

Resumen: 9 REUTILIZAR, 1 INSTALAR (opcional), 6 CREAR.

## Impacto en la estructura
- `src/modules/payments/services/`: `createPayment.ts`, `paymentApi.ts` (`handleCreatePayment`), `processWebhookInbox.ts`, `fulfillOrder.ts`, `latePayment.ts`, `stripeClient.ts` (factory único del SDK, evita duplicar `new Stripe`), tests colocados.
- `src/modules/payments/components/`: `PayButton.tsx`, `PaymentResult.tsx`; `hooks/usePaymentStatus.ts` (polling acotado); `types.ts`; actualizar `index.ts` (cliente) y crear `server.ts` si hay exportes de servidor, siguiendo el patrón de `checkout`.
- Rutas: `src/app/api/checkout/[orderId]/payment/route.ts`, ruta del disparador (P5), páginas bajo `src/app/pedidos/[orderId]/pago/...` delgadas.
- Posible migración aditiva en `drizzle/` solo si P4 lo exige.
- Modificar `OrderSummary`/`OrderPage` para integrar `PayButton` (fichero de `checkout`; coordinar vía barrel, sin importar internos de `payments`).

## Requisitos de testing
Vitest (+ RTL para UI), Stripe simulado con un cliente inyectable; BD con el harness existente.
- **Unitario/servicio (obligatorio):** creación idempotente de pago y rechazos (CA-1 a CA-5); reclamo atómico y concurrencia (CA-6/7); idempotencia por evento (CA-8); validación de importe/moneda (CA-9); reintentos y tope (CA-10 a CA-12); a tiempo vs tardío con la frontera `paid_at == expires_at` y webhook entregado tarde (CA-13, CA-15); fallo y eventos fuera de orden (CA-16/17); gancho llamado una sola vez (CA-14); autorización del disparador (CA-18).
- **Regresión:** el test existente de `stripeWebhook` sigue verde (CA-19).
- **Componentes (RTL):** `PayButton` (estados, error, deshabilitado), `PaymentResult` (procesando/confirmado/cancelado/fallido/tardío) con temporizadores falsos (CA-20 a CA-23).
- No se testean: el SDK de Stripe ni la página alojada de pago; el cableado de rutas triviales (se cubre con el handler).
- Verificación de CA-24: búsqueda estática de campos de tarjeta en la revisión.

## Riesgos y preguntas abiertas
Decisiones que NO están definidas; las propuestas son recomendaciones, no reglas aprobadas.

- **P1 — Checkout Session vs PaymentIntent (BLOQUEANTE).** Propuesta: Checkout Session alojada (`mode=payment`, PEN, `expires_at` = 30 min), pues garantiza ausencia de PAN/CVV y acota el trabajo de UI; encaja con la nota de §6.2. PaymentIntent + Elements permitiría el plazo exacto de 15 min pero añade formulario cliente y `@stripe/stripe-js` (requiere `npm install` desde la terminal del usuario). Define también qué eventos se procesan.
- **P2 — Cuenta Stripe y moneda (BLOQUEANTE para pruebas reales).** Stripe-planner-input advierte verificar si la cuenta de plataforma puede cobrar en PEN; hay que confirmar claves de test y `STRIPE_WEBHOOK_SECRET` en entorno.
- **P3 — Pago tras vencer la reserva (decisión confirmada en §3, detalle abierto).** Confirmado: reembolso automático sin ticket. Abiertos: (a) ¿el reembolso se hace en este spec o solo se marca para tarjeta de reembolsos? (b) si el cupo ya se vendió a otro, ¿igual reembolso? (propuesta: sí, siempre); (c) si la reserva venció pero nadie más tomó el cupo y la tarjeta 05 aún no corre, ¿se honra el pago? (§3 dice que no; se propone seguir §3). (d) estado final de la orden (`pending` hasta que 05 la expire vs. `cancelled`). Además, `refund` exige `payment` coherente; `payment.status` final propuesto: `refunded`.
- **P4 — Política de reintentos.** Propuesta: máximo 5 intentos con espera exponencial (1, 2, 4, 8, 16 min); tras agotarlos `failed` + `audit_log`. Esperas requieren columna `next_attempt_at` (migración aditiva) o calcularlas desde `created_at`/`attempts`. Hace falta decidir también cómo se reanuda un evento `processing` huérfano (timeout de reclamo, propuesta 5 min).
- **P5 — Cómo se dispara el procesador.** Opciones: (1) Cloud Scheduler → endpoint protegido cada minuto (encaja con Cloud Run); (2) invocación inmediata tras persistir en el webhook (rompe CA-19 y el patrón «recibo duradero» actual); (3) ambas, con el scheduler como red de seguridad. Propuesta: 1 + disparo oportunista no bloqueante opcional. En local: script o llamada manual. Tarjeta 05 también necesitará un disparador periódico; conviene un único endpoint de «tareas».
- **P6 — Rutas y textos de resultado.** Propuesta de rutas bajo `/pedidos/[orderId]/pago/...` (el repo usa rutas en español); confirmar. El token de invitado viaja en el fragmento `#t=`; las `success_url`/`cancel_url` deben conservarlo (Stripe puede no conservar fragmentos de forma garantizada: verificar o usar otra vía).
- **P7 — Cuántos pagos por orden.** Propuesta: un `payment` activo por orden; reintento tras fallo crea otro con nueva clave (`orderId:n`). Confirmar.
- **P8 — Datos del comprador en Stripe.** ¿Se envía `customer_email`/`order.buyer_email` a Stripe y se guarda `stripe_customer_id`? Propuesta: enviar solo el email; no crear Customer.
- **P9 — Carrera con la tarjeta 05.** Si 05 expira la sesión/orden mientras llega un pago, ambos procesos deben tolerar el orden inverso; definir en 05 con la regla de CA-15 (tiempo de finalización en Stripe).
- **P10 — Webhook endpoint.** Los eventos relevantes deben estar suscritos en el dashboard/CLI (`checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, etc.).

### Corte por iteraciones (si es mayor que una sesión)
- **Iteración 1 (mínimo con valor):** creación de pago + procesador + camino a tiempo + fallo + páginas de resultado (CA-1 a CA-14, CA-16 a CA-22, CA-24, CA-25).
- **Iteración 2:** pago tardío con reembolso automático (CA-15, CA-23) una vez resuelta P3; puede entregar antes solo el marcado `failed`/auditoría sin reembolso si P3(a) lo difiere.

**Continuidad:** implementación autorizada por la petición de continuar; ver decisiones actuales en `plan.md` y resultados de verificación en `review.md`.
