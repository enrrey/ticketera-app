# Puesta en marcha: entradas, correos y check-in

## Correo de confirmación (tarjeta 06)

Configurar en el archivo local de entorno, sin versionar credenciales:

- `RESEND_API_KEY`: clave del proveedor Resend.
- `RESEND_FROM_EMAIL`: dirección de un dominio verificado en Resend.
- `APP_URL`: `http://localhost:3000` en desarrollo; origen público HTTPS en producción. `NEXT_PUBLIC_APP_URL`, si existe, tiene prioridad.
- `QR_SIGNING_SECRET`: conservar el secreto actual; cambiarlo invalida credenciales derivadas y payloads cifrados existentes.

Ejecutar `npm run payments:work` para procesar webhooks, vencimientos y confirmaciones pendientes. También se admite `npm run payments:process` para una pasada o el endpoint interno protegido ya existente.

El pago y la emisión de entradas crean una sola notificación por pedido en la misma transacción. El correo enlaza las entradas, también para compradores invitados. El enlace contiene una credencial en el fragmento de URL; no debe compartirse. El mensaje se guarda cifrado y se reutiliza sin cambios en los reintentos con la misma clave de idempotencia.

Sin configuración de Resend la cola queda pendiente. Hay un máximo de cinco intentos y una ventana de 24 horas con margen para el timeout del proveedor. Los fallos terminales quedan auditados; no se reinician automáticamente para evitar envíos duplicados fuera de la ventana de deduplicación. Una recuperación manual exige conciliar primero el resultado con Resend.

No se enviaron correos reales durante la implementación. La entrega real queda pendiente de configurar y comprobar con un destinatario autorizado.

## Mis entradas (tarjeta 07)

`/mis-entradas` requiere autenticación Clerk y el permiso `tickets.read_own`. Muestra entradas reales del comprador, su estado y el QR cuando corresponde. Las compras de invitado se vinculan mediante correos verificados de Clerk sin reasignar pedidos de otro usuario.

## Check-in (tarjeta 08)

`/validar-entradas` está disponible desde el panel para personal activo con `tickets.check_in`. Un organizador accede únicamente a sus eventos; administradores pueden acceder a todos. Permite cámara o ingreso manual de la credencial QR.

El servidor confirma evento, pago y estado de la entrada antes de registrar un único ingreso auditado. Un segundo escaneo informa que la entrada ya se usó. Los permisos se verifican de nuevo dentro de la transacción. No se consumieron entradas reales en las pruebas.

La cámara necesita permiso del navegador y un contexto seguro (localhost o HTTPS). La interacción con una cámara física sigue pendiente de verificación manual; las pruebas automatizadas usan un lector simulado.

## Calidad pendiente (tarjeta 16)

La auditoría de dependencias ejecutada en esta sesión reportó 16 avisos: 12 altos y 4 moderados. Next.js 16.3.6 figura entre las dependencias afectadas. No se aplicó `npm audit fix --force`, porque también propone degradaciones de herramientas. La actualización y la verificación de compatibilidad quedan registradas para la tarjeta 16 antes del lanzamiento.
