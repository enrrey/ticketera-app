# Configuración y alcance

## Pantallas

- `/organizador/configuracion`: nombre de negocio y RUC propio. El formato de RUC no equivale a verificación SUNAT. Si hay una cuenta Stripe registrada, se consulta su estado canónico; no se deduce de los datos del perfil. Crear cuentas/onboarding requiere confirmar país legal y configuración Connect.
- `/organizador/metricas`: ventas, pagos capturados, devoluciones confirmadas, ingresos netos, eventos y check-in. Admin/super admin ve global; organizador ve lo propio.
- `/organizador/reembolsos`: listado paginado de solicitudes. Requiere `refunds.manage`; organizador solo puede consultar devoluciones correspondientes a sus eventos.
- `/mis-entradas`: devolución por unidad con confirmación; regla servidor de 48 horas, cuenta activa y propiedad. QR pendiente/refunded no se presenta como válido.
- Detalle de evento: compartir y guardar en este navegador (favoritos locales, no sincronizados entre dispositivos).

## Compra y Stripe

Entradas → Datos y pago → Confirmación. Selección de asientos bloqueada 60 segundos; reserva de pedido nuevo 10 minutos. El vencimiento guardado de pedidos históricos se conserva. El minimapa representa filas reales; zoom, desplazamiento y paginación no alteran el inventario.

Checkout Sessions con `ui_mode: elements` conserva Invoicing y la conciliación existente. `payment.ui_mode` guarda el modo antes de llamar a Stripe, para reconstruir idénticos parámetros tras una respuesta perdida. Pedidos con una sesión alojada previa siguen usando esa sesión. Los métodos de pago corresponden a la configuración Stripe; este cambio no fuerza un método ni utiliza PaymentIntent directo. La emisión se realiza exclusivamente en backend después de verificar el pago canónico.

Documento y celular son obligatorios en el endpoint público, junto con aceptación de versión `2026-10-09`. Documento cifrado con AES-GCM y clave derivada del secreto privado existente; no aparece en Stripe, logs o respuesta pública. Conservar el secreto estable: una rotación requiere migrar datos cifrados y credenciales QR. Las páginas de términos/privacidad son textos de desarrollo, pendientes de datos legales del operador antes de uso comercial.

## Devoluciones

Solicitud → QR bloqueado → llamada idempotente a Stripe → conciliación → asiento disponible tras `succeeded`. Una cancelación encola las unidades pagadas restantes, conserva historial y no modifica portada/sesiones/precios. Requiere `events.manage` y `refunds.manage`; el permiso financiero no está concedido por defecto al organizador y puede asignarse desde Usuarios y permisos. Se rechazan eventos finalizados y pedidos pagados cuya emisión esté incompleta, para evitar cancelarlos sin devolver sus entradas.

El proceso `npm run payments:work` invoca el endpoint interno cada minuto con `PAYMENT_JOBS_SECRET`; no solapa lotes. Procesa inbox, vencimientos, devoluciones y notificaciones. En producción necesita un scheduler configurado. Fallos agotados/requiere acción permanecen visibles para conciliación; webhook genuino del reembolso existente permite recuperar sin duplicar devoluciones.

## Pendientes externos

1. País legal de la plataforma/organizadores y responsabilidades Stripe Connect; no crear cuentas declarando otro país. Se conserva la decisión aprobada de liquidación manual por evento y sin comisión de plataforma para el MVP.
2. `RESEND_API_KEY` y `RESEND_FROM_EMAIL` de remitente verificado; validar entrega antes de cerrar la tarea de correo.
3. Revisión visual responsive, cámara física y compra Elements de extremo a extremo en sandbox. La herramienta de navegador falló al iniciar; no se registró esa validación como aprobada.
4. Auditoría de dependencias y despliegue son tareas distintas del tablero; no se realizó deploy, pago comercial ni envío masivo de correos.
