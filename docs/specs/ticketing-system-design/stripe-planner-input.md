# Entrada preparada para stripe_implementation_planner

Estado: pendiente de conexión de Stripe y ejecución real de la herramienta. Este documento no es una respuesta del planner ni un plan aprobado.

Fuente de verdad: [system design](./spec.md). Enviar su contenido completo junto con el siguiente encargo, adaptando los argumentos al esquema real de la herramienta cuando esté disponible.

## Encargo

Analiza el system design de Ticketera y recomienda una integración con Stripe Payments e Invoicing, compatible con Stripe Connect para liquidaciones. Identifica decisiones pendientes y restricciones antes de proponer implementación. No crear recursos ni ejecutar cobros.

Contexto actual del repositorio: Next.js App Router, React, TypeScript y Clerk instalado. Checkout es una demostración; no hay dependencia Stripe, persistencia PostgreSQL ni ORM declarados en package.json. El diseño conserva una descripción histórica previa a la instalación de Clerk. Monolito modular por dominios, PostgreSQL local y Cloud Run/Cloud SQL propuestos para producción.

Requisitos confirmados:

- Mercado Perú, moneda PEN, zona America/Lima. Verificar por separado disponibilidad de cuentas de plataforma, moneda de cobro, liquidación y cuentas Connect según país de la entidad; no asumir que vender en Perú determina dónde se puede abrir la cuenta Stripe.
- Pago único por orden en cuenta central. Compradores autenticados con Clerk o invitados con correo obligatorio. Precios y descuentos calculados en servidor, con snapshots y unidades monetarias exactas.
- Reserva transaccional de inventario de 15 minutos. Comparar alternativas Payments compatibles con este plazo. Para Checkout hospedado, verificar límites actuales de expires_at y proponer expiración explícita/reconciliación, manejando carreras entre expiración y pago sin sobreventa.
- Webhooks firmados e idempotentes por stripe_event_id. Emitir un ticket y QR opaco por unidad únicamente tras confirmar pago válido. Distinguir pago realmente tardío de entrega tardía del webhook. Reembolsar pago posterior al vencimiento sin emitir entradas.
- Reembolso por tickets individuales hasta 48 horas antes del evento; cancelación de evento con reembolsos masivos e invalidación de tickets. Registrar fallos y estados pendientes para conciliación.
- Connect: onboarding/verificación de organizadores, liquidación iniciada por Administrador, idempotencia y conciliación. Distinguir transferencia a cuenta conectada de payout a banco; explicar impacto de refunds sobre transferencias ya realizadas.
- No almacenar PAN/CVV ni exponer secretos; modo de prueba separado de producción.

Invoicing es una ampliación solicitada y aún no está definida en el system design. Evaluar facturación posterior al pago de una orden frente a un flujo de cobro mediante invoice. Recomendar cómo evitar cobrar dos veces, relacionar order/payment/customer/invoice y gestionar devoluciones, documentos y eventos de invoice. Separar recomendaciones de decisiones aprobadas. Identificar qué debe confirmarse sobre solicitud de factura, datos del comprador, impuestos, numeración y comprobantes fiscales peruanos; no asumir que una invoice Stripe satisface requisitos locales.

Salida solicitada: alternativas y recomendación justificadas con documentación oficial actual, flujo Payments + Invoicing sin doble cobro, objetos Stripe y correspondencias con el MER, eventos webhook, manejo de expiración/concurrencia/reintentos, limitaciones geográficas, decisiones de producto pendientes y pruebas críticas. Respetar límites de dominio payments/checkout/tickets/settlements/notifications del diseño.

## Continuación

1. Confirmar que Stripe está conectado y que stripe_implementation_planner está expuesto.
2. Leer el esquema real de la herramienta y ejecutar con este encargo y el contenido completo de spec.md.
3. Conservar la respuesta real y reconciliar sus recomendaciones con las reglas confirmadas. No presentar esta entrada como resultado de Stripe.
