# Verificación de Payments, Invoicing y expiración

Fecha: 2026-10-07, America/Lima. Implementación solicitada por continuidad de tareas; no se hizo commit, push, despliegue ni actualización de tarjetas Trello.

## Resultado

- `npm run test -- --maxWorkers=1 --pool=forks`: 41 archivos, **210 pruebas aprobadas**, código de salida 0.
- `npm run typecheck`: salida 0 después de incorporar los scripts finales.
- `npm run lint`: salida 0 después de incorporar los scripts finales.
- `npm run build`: salida 0; incluye `/api/checkout/[orderId]/payment`, `/api/internal/payment-jobs` y `/pedidos/[orderId]/pago/[outcome]`.
- `git diff --check`: salida 0; avisos de normalización LF/CRLF de Windows, sin errores de whitespace.
- Migraciones 0010 y 0011 aplicadas correctamente; aditivas y sin borrado de filas.
- Cuenta Stripe de prueba verificada: `acct_1ULZrh0RxQwFKGJe`. Sesión real de prueba en PEN con `invoice_creation.enabled=true`, cerrada antes de cobrar. No se creó una orden en la BD durante esa comprobación.
- Canal real: Stripe `customer.created` → listener → POST webhook HTTP 200 → firma válida → inbox durable → worker → `processed`. Customer temporal sin correo eliminado; su `customer.deleted` recibió 200 y también fue procesado.
- Rechazos HTTP reales: job sin secreto 401; webhook sin firma 400; pedido inexistente 404; origen ajeno 403.
- Después de la prueba real: **0 pedidos, 0 pagos y 0 tickets**. No se hicieron cargos ni ventas.
- Listener local y procesador por minuto quedaron activos durante la sesión. Para reiniciarlos: `npm run stripe:listen` y `npm run payments:work`.

## Hallazgos corregidos y cubiertos

Revisión independiente de solo lectura: recuperaciones de refunds descubiertos por expiración sin otra notificación; fuente única de timestamp (`payment_intent.succeeded` canónico); conservación de inventario mientras Stripe procesa; recuperación de refund exitoso aun después de agotar presupuesto local; liberación tras intent cancelado; normalización `canceled` de Stripe a `cancelled` en BD. Pruebas adicionales cubren respuesta perdida, reintento sin duplicar, límite temporal exacto, webhook tardío de pago puntual, estados de fallo posteriores al éxito y worker viejo tras recuperar un lease.

## Límites de esta entrega

La confirmación de una compra completa se probó con gateway Stripe simulado y PostgreSQL aislado. Las comprobaciones contra Stripe real cubrieron configuración, moneda, Invoicing y canal webhook; no se introdujo una tarjeta de prueba ni se hizo un cobro. No se emiten aún tickets/QR ni correo de entradas. El scheduler de producción requiere despliegue/configuración en la tarea de infraestructura; el desarrollo local usa el procesador activo. El comprobante Stripe no se presenta como factura tributaria peruana.

Configuración y recuperación documentadas en `setup.md`. Los reembolsos agotados o que requieren acción quedan auditados para revisión manual. La búsqueda del evento de éxito fuera de su webhook directo está acotada a 1000 eventos; si no se encuentra, se difiere sin consumir inventario.
