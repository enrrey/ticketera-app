# Pruebas locales

Google Cloud y publicación pospuestos por el usuario el 2026-10-12. No es necesario contratar infraestructura para estas pruebas.

## Pantallas

1. Abrir `/`, comprobar que los eventos vienen de la base y que los destacados aparecen en el Hero.
2. Entrar con Clerk como super admin. En `/organizador`, crear un evento de prueba con fecha futura, portada, sesiones, sede, tipos y precios. Activar zonas numeradas y definir filas/asientos; revisar la vista previa. Destacar el evento y verificar la landing.
3. Editar el evento, filtrar el listado por nombre, fecha y estado. Verificar acciones en ancho móvil.
4. Abrir el evento como comprador. Elegir una zona y tres asientos; comprobar su precio y número. En otro navegador, esos asientos deben estar bloqueados temporalmente. Sin continuar, al vencer los 60 segundos deben poder seleccionarse nuevamente.
5. Continuar a datos y pago; completar nombre, correo, documento y celular, aceptar términos. La orden creada debe mostrar tres entradas y una reserva de diez minutos.
6. Verificar `/mis-compras` y `/mis-entradas` con la cuenta compradora. Ninguna entrada pendiente de pago debe presentarse como válida. Un usuario distinto no puede leer la compra.
7. En `/organizador/metricas`, comprobar totales y desglose por tipo. Un organizador ve solo sus eventos; admin/super admin ve el total global.
8. En `/administracion/usuarios`, comprobar filtros, paginación y permisos. Una invitación debe llegar por correo mediante Clerk y regresar a la aplicación después de autenticar.

## Pago, QR y devoluciones

Estos pasos requieren el listener de Stripe y procesamiento del inbox. El listener se inicia con `npm run stripe:listen`; el worker continúa detenido hasta autorización explícita porque también puede ejecutar devoluciones pendientes de la base actual. Recibir el webhook no acredita que ya se haya procesado el pago.

Después de completar una compra de prueba y procesar su pago: tres entradas deben producir tres QR distintos. Probar un QR en `/validar-entradas`; el segundo escaneo debe rechazarse. Solicitar devolución de una unidad elegible en Mis entradas: bloquear solo ese QR; el cupo se libera cuando Stripe confirme la devolución. Cancelar un evento de prueba con permisos `events.manage` y `refunds.manage` debe encolar sus unidades pagadas restantes.

Correo de confirmación pendiente de configurar Resend y validar entrega. Connect y promociones pendientes: no deben confundirse con funciones terminadas. Promociones acumulará descuentos según la decisión del usuario, pero todavía no está implementado su CRUD ni su aplicación.

Anotar cada fallo con ruta, acción, resultado esperado y resultado obtenido, sin incluir contraseñas, claves privadas, documentos ni credenciales QR.
