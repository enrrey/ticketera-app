# Continuación Trello 05–08

Solicitud autorizada: continuar las tareas de Trello, 9 octubre 2026. La tarjeta 05 ya dispone de expiración protegida, reconciliación y reembolso tardío; validar sus pruebas antes de cambiar estado. Las tarjetas 06 y 07 tienen implementación parcial. Completar correo, consulta directa de tickets y check-in, preservando compra, Stripe y plano existentes.

06: generar una confirmación persistente por pedido pagado, junto a la emisión transaccional de tickets. Resend elegido en el diseño; enlace privado permite acceder también como invitado. Conservar token original; token adicional solo hash en pedido y contenido del correo cifrado. Envío fuera de transacción, payload estable, clave idempotente, claim con lease y reintentos acotados a la ventana de idempotencia del proveedor. Configuración ausente conserva pendientes sin enviar. No enviar correo real desde esta sesión sin instrucción explícita del usuario.

07: /mis-entradas muestra tickets propios paginados con estado, evento, fecha y QR válido; no lista pedidos pendientes como entradas. Cuenta activa y permiso tickets.read_own, sin acceso a tickets ajenos. Vinculación existente de compras guest únicamente a correos verificados, sin reasignar pedidos con dueño. Retirar prototipo/enlaces muertos que ya no componen rutas reales.

08: operador admin/super_admin/organizador activo con tickets.check_in, y organizador solo su evento. Endpoint de escritura con origen y sesión Clerk; revalidar permisos en transacción. Verificar hash del QR opaco, evento, ticket válido, orden pagada/parcialmente reembolsada y pago confirmado. Evento cancelado rechaza. Consumo único por evento completo, ticket lock y restricción unique previenen concurrencia. Auditoría sin token/PII. Cámara móvil iniciada por botón, detención al salir; alternativa de pegar código. Mostrar válido/usado/inválido/reembolsado con resultado explícito. No consumir compras reales para probar.

Fuera de este bloque: reembolsos individuales/masivos (09), promociones (10), liquidaciones y despliegue (12–15). Registrar avances según pruebas y limitaciones reales, sin declarar completado el correo si falta remitente/clave.

Validación: PGlite para transacciones y aislamiento; tests del gateway de correo simulado, API permisos/origen, doble escaneo; RTL para cámara/control manual, listado y estados. Typecheck, lint y build. Revisar secretos ignorados sin leer valores.
