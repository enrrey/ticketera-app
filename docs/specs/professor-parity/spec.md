# Pantallas y tareas del profesor

Estado: IMPLEMENTACIÓN AUTORIZADA por solicitud explícita de proceder con los nueve casos y completar las trece tareas, 2026-10-09.

Reutilizar landing, catálogo, CRUD, Clerk, reservas, webhooks, QR y check-in ya implementados. Objetivo: completar diferencias funcionales de las capturas conservando órdenes existentes.

1. Configuración: perfil de negocio propio (nombre y RUC), estado de Connect verificable, onboarding iniciado por el organizador. No crear ni completar cuentas reales por cuenta del usuario. País de la entidad y elegibilidad deben confirmarse antes de aprovisionar.
2. Landing/detalle: datos reales y acciones útiles; favoritos/compartir donde corresponda, sin inventar catálogo.
3. Selección: mapa general, selección de tribuna, numeración y ocupación reales; añadir zoom, desplazamiento y minimapa al plano de asientos.
4. Compra: mostrar Entradas → Datos y pago → Confirmación; datos de comprador nombre, correo, documento y celular; aceptar versión de términos y privacidad en servidor; no transmitir documento a Stripe ni logs.
5. Reservas nuevas: diez minutos, conservar vencimientos de órdenes anteriores y bloqueo inicial de asiento de sesenta segundos.
6. Pago: formulario Stripe dentro de Ticketera, precios servidor, estado canónico y emisión solo por backend. Reutilizar Checkout Sessions con Elements para conservar facturas, conciliación y vencimiento; mantener compatibilidad con sesiones alojadas anteriores. No ejecutar pagos reales.
7. Confirmación/Mis entradas: preservar QR por unidad, vinculación por email verificado y cola de correo. Entrega real pendiente de credenciales/remitente Resend.
8. Reembolsos: solicitud por ticket hasta 48h antes del inicio; cancelación de evento encola todos los pedidos pagados; impedir check-in de tickets pendientes, conciliación Stripe antes de liberar inventario; retries idempotentes y auditoría sin PII.
9. Dashboard: métricas globales protegidas para admin, propias para organizador; cifras reales de ventas, ingresos, reembolsos y check-in.

Trece tareas: verificar consolidación/build y secretos; Clerk; detalle; catálogo; reserva/mapa; perfil/Connect; pago integrado; webhook/emisión; confirmación/entradas; job vencimiento; check-in; cancelaciones/reembolsos; dashboard. Registrar resultados exactos, sin marcar completo lo que depende de verificación externa.

Validación: migraciones aditivas sin reset; pruebas de contrato/permiso y concurrencia; regresión de pagos y legado; ESLint, TypeScript, build y suite al integrar. Guardar cambios en commits por bloque revisado dentro del alcance de consolidación solicitado; nunca publicar/deployar ni enviar mensajes a terceros.
