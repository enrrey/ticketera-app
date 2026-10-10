# Verificación y uso

El editor permite elegir un recinto registrado accesible al organizador o registrar uno nuevo. Al habilitar el plano, se elige estadio, teatro o distribución personalizada, ubicación del escenario y posición de cada zona. Las entradas numeradas definen filas y asientos; el aforo se valida contra su suma. La vista previa utiliza el mismo renderer que la página de compra. Es un esquema referencial, sin afirmar geometría ni aforo oficial del estadio.

Seleccionar una butaca crea un bloqueo de 60 segundos en el servidor. La propiedad se prueba mediante un token privado, almacenado en sessionStorage y transmitido en un encabezado. Deseleccionar libera solamente los asientos del propietario. El vencimiento se calcula con el reloj de la base de datos. Se puede renovar explícitamente; no se renueva automáticamente por mantener la página abierta. El navegador consulta disponibilidad cada cinco segundos; cualquier conflicto se verifica nuevamente al escribir en el servidor.

Crear un pedido consume los bloqueos propios y crea las reservas de inventario en la misma transacción. Desde entonces rige la reserva de pago existente de 15 minutos, con reconciliación de Stripe antes de liberar inventario asociado a un pago pendiente. Los pagos confirmados mantienen ocupados sus asientos. No se reasignan asientos a compras históricas de entradas de pie.

Los cambios de distribución y el borrado se impiden durante bloqueos activos. Los eventos con pedidos conservan condiciones de venta; siguen disponibles las modificaciones permitidas de portada/destacado.

La migración 0013 incorpora configuración del plano, posición de tribunas y seat_hold. Habilita el plano de los eventos que ya tenían entradas numeradas. El evento identificado de prueba tiene Occidente, Oriente y Sur, con 25 asientos por tribuna; su configuración exige que no existan pedidos ni bloqueos activos.

Comprobaciones realizadas: pruebas del servicio sobre exclusión entre compradores, vencimiento, liberación y conversión a pedido; 44 pruebas de editor, catálogo/permisos, vista pública, hook y esquema; typecheck y lint. Verificación HTTP con dos compradores reales de prueba: primero reservado, segundo rechazado con 409, asiento públicamente ocupado y disponible tras liberación; duración exacta de 60 segundos. Navegador: selección A-1, precio, cuenta regresiva y selección vacía tras vencimiento. El script scripts/verify-seat-holds.mjs no crea pedidos ni imprime tokens y limpia únicamente sus propios bloqueos.

Referencias de diseño:

Verificación final: suite completa con 234 pruebas en 50 archivos aprobadas; typecheck, lint y compilación de producción aprobados. Revisión independiente de exclusión, propiedad, vencimiento y conservación de pagos pendientes sin hallazgos materiales.

- https://docs.seats.io/docs/api/hold-tokens/
- https://docs.seats.io/docs/tutorial/submit-hold-token/
- https://docs.stripe.com/api/checkout/sessions/expire
