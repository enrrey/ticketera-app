# Payments e Invoicing

Cuenta local: sandbox/test de Ticketera. `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` permanecen en `.env`/`.env.local` ignorados por Git. `APP_URL` debe ser el origen canónico de la web. `PAYMENT_JOBS_SECRET` es un secreto distinto, generado localmente, para el procesador interno.

## Desarrollo

1. `npm run db:migrate` aplica las columnas aditivas del inbox.
2. `npm run dev` sirve la aplicación.
3. `npm run stripe:listen` recibe eventos de prueba con Stripe CLI y la clave local del proyecto, actualiza automáticamente `STRIPE_WEBHOOK_SECRET` en `.env.local` y oculta el secreto en la salida. Mantener ese proceso abierto. También se puede usar `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, asegurando que el `whsec_...` coincida con la variable; no imprimir/compartir el secreto.
4. `npm run payments:work` procesa un lote cada minuto hasta detener el proceso. `npm run payments:process` ejecuta un solo lote. No basta con recibir el webhook: la confirmación es responsabilidad del procesador.
5. `npm run verify:stripe` comprueba cuenta, PEN y comprobante postpago creando/cerrando una sesión de prueba sin cobrar ni crear pedidos en la BD.
6. `npm run verify:stripe:webhook` comprueba el canal real creando un Customer de prueba sin correo/cobros, verifica firma + inbox + worker y elimina ese Customer al finalizar. El listener debe estar activo.

En producción, Cloud Scheduler debe invocar cada minuto `POST /api/internal/payment-jobs` con `Authorization: Bearer <PAYMENT_JOBS_SECRET>`, desde un servicio autorizado. Este cambio entrega el endpoint; no despliega Cloud Scheduler ni modifica servicios externos. Mantener las claves en Secret Manager. Supervisar `webhook_event.status='failed'`, auditorías `stripe.webhook_failed` y `payment.refund_needs_attention`.

Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `invoice.paid`, `invoice.finalized`, `invoice.updated`, `refund.created`, `refund.updated`, `refund.failed`.

## Comportamiento

- Una sesión Stripe y clave idempotente por pedido. El intento se guarda antes de llamar a Stripe; una respuesta perdida se recupera con la misma clave. Una tarjeta fallida se puede reintentar dentro de la misma sesión y plazo, sin duplicar cobros.
- Stripe calcula el importe enviado desde la orden persistida; el cliente no proporciona importes ni campos de tarjeta. No se activa cálculo de impuestos. Se mantienen los métodos dinámicos configurados en la cuenta y PEN sin Adaptive Pricing.
- Invoicing genera un comprobante después del pago mediante `invoice_creation.enabled`; no crea una factura adicional para cobrar otra vez. El enlace/PDF se muestra al dueño o invitado autorizado cuando la factura está disponible. No se presenta como factura tributaria peruana.
- El token invitado sale una sola vez en el fragmento del enlace de pedido. Antes de redirigir se guarda en `sessionStorage` de esa pestaña y nunca se envía a Stripe. Para otro dispositivo o si se borra el almacenamiento, abrir el enlace original que contiene el fragmento, o iniciar sesión con la cuenta vinculada.
- Success URL solo muestra estado del servidor y consulta cada 2 segundos hasta 30 veces. Puede recargarse después; no confirma pagos por sí misma.
- El inbox reclama eventos con `FOR UPDATE SKIP LOCKED`, lease de 5 minutos y token de reclamo. Reintenta hasta 5 veces, con espera 1/2/4/8 minutos antes de los siguientes intentos. Fallos terminales requieren revisión manual, no reintentos infinitos.
- La hora de pago proviene de un evento de éxito consultado en Stripe, nunca de `Charge.created` ni de la entrega local. Si el timestamp aún no está disponible, se reintenta sin vender inventario. En cuentas con mucho tráfico, el adaptador detiene la búsqueda tras 1000 eventos y deja el evento pendiente/failed para reconciliación; el webhook directo de éxito evita esa búsqueda.
- Mientras haya un intento sin cerrar, la reserva vencida conserva el cupo hasta reconciliar/expirar su sesión. Stripe mínimo 30 minutos; el job cierra explícitamente a los 10 minutos para pedidos nuevos (conserva vencimientos anteriores). Si hay fallo de red se conserva el cupo para no sobre-vender. Un pago completado fuera del plazo genera reembolso automático y no confirma venta ni emite tickets.
- El reembolso guarda su fila/clave antes de llamar a Stripe; si ya tiene id de Stripe consulta su estado. `refund.attempts/next_attempt_at` permiten recuperar devoluciones pendientes aunque no llegue otro webhook y aunque el pedido ya esté cancelado. Hay máximo cinco fallos consecutivos, backoff y auditoría; las respuestas canónicas pendientes se vuelven a consultar. Un webhook genuino de un refund conocido permite corregir el estado local incluso después de agotar reintentos, sin crear otra devolución.
- El gancho de emisión funciona dentro de la transacción de confirmación, una vez por pedido. La emisión genera un QR por unidad y encola correo cifrado con Resend; entrega externa requiere configuración y validación del remitente.

## Compatibilidad y rollback

`0010_old_meteorite.sql` añade `next_attempt_at`, `claimed_at`, `claim_token` e índice al inbox; `0011_brainy_fallen_one.sql` añade `attempts` y `next_attempt_at` a refund. No borran filas ni cambian las restricciones anteriores. Para revertir aplicación: detener scheduler/nuevos pagos primero, reconciliar intentos abiertos y conservar las columnas. No volver al cálculo viejo de disponibilidad mientras existan sesiones de pago abiertas: liberaría cupo sin consultar Stripe. No se requiere bajar el esquema ni destruir datos.
