# Revisión de las tarjetas 05–08

Fecha: 2026-10-09 (America/Lima).

## Implementación revisada

- 05: expiración y reconciliación existentes, con reembolso de cobros tardíos. En revisión en Trello.
- 06: emisión por unidad y confirmación persistente con Resend. La configuración ausente no reclama notificaciones ni envía correos. Queda en proceso por falta de clave y remitente verificado.
- 07: consulta de tickets propios, QR condicionado al pago, paginación y estados vacíos/error. Compras invitadas se vinculan con correo verificado sin reasignar pedidos ajenos. En revisión en Trello.
- 08: escaneo mediante cámara o código manual; acceso del organizador restringido a su evento. Pago/estado y consumo único se verifican en transacción. En revisión en Trello.

## Hallazgos corregidos

La revisión detectó una carrera entre revocar permisos y consumir un QR. El check-in bloquea ahora la fila del operador antes de revalidar permisos y conserva el bloqueo hasta el commit, coordinándose con las operaciones de personal.

También detectó que un worker de correo podía enviar después de perder su claim o agotar la ventana del proveedor. El envío verifica de nuevo el token de ownership y los plazos con el reloj de la base de datos inmediatamente antes de llamar al gateway. Tres regresiones reprodujeron el fallo antes del arreglo y pasan después del arreglo. La segunda revisión no encontró nuevos hallazgos concretos en esas correcciones.

## Verificación

- Migración 0014 aplicada sin reiniciar datos.
- Build de producción y su comprobación TypeScript: pasan.
- ESLint global: pasa.
- `git diff --check`: pasa (solo avisos de conversión LF/CRLF).
- `.env` y `.env.local`: ignorados por Git.
- Pruebas focalizadas: correo 10, interfaz del lector 12, tickets propios/interfaz 9, check-in y flujos de pago/lectura 25; todas pasan.
- Suite completa final: 56 archivos y 268 pruebas pasan (`npm test -- --maxWorkers=1 --pool=forks --testTimeout=15000`, 459.80 segundos).
- Navegador sin sesión: `/validar-entradas` redirige a Clerk conservando la ruta de retorno.

## Límites y trabajo pendiente

No se enviaron correos reales ni se consumieron entradas reales. La entrega con Resend y el uso de una cámara física requieren verificación manual. Consultar `setup.md` para la configuración y el manejo de fallos terminales de correo.

Las tarjetas 09–16 permanecen pendientes. La auditoría real de dependencias quedó registrada en la tarjeta 16; no se aplicaron actualizaciones forzadas.
