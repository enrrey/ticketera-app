# Entradas, asientos y compras reales

Autorizado por la solicitud del usuario del 7 de octubre de 2026; complementa el system design existente.

1. Reservar asientos numerados a partir de las filas y zonas configuradas, validando ubicación, cantidad y disponibilidad dentro de la transacción. Serializar compras del mismo evento; la reserva existente gobierna cuándo se libera el asiento. Sin asignaciones ficticias para entradas generales ya compradas.
2. Emitir exactamente una entrada por unidad al confirmar un pago válido, en la misma transacción. QR opaco, sin datos personales, reconstruible con una clave privada estable; unicidad por ítem y unidad, emisión repetida idempotente. Recuperar entradas de pedidos pagados anteriores.
3. Mostrar pedidos y entradas reales en Mis compras/Mis entradas. Acceso limitado al propietario autenticado; invitados únicamente mediante el token privado del pedido. No confiar en correo o identificadores enviados por el cliente.
4. Organizar el editor en secciones guiadas con resumen y vista previa de zonas/filas. Mostrar mapa de ubicación a partir del recinto real y mapa de asientos solo para modalidades numeradas.
5. Verificar cantidad tres → tres entradas/QR distintos, idempotencia, aislamiento entre compradores, rechazo de asiento inválido/ocupado y liberación segura. Ejecutar revisión de seguridad y verificaciones del proyecto.

Decisiones: un asiento físico se identifica por evento, zona normalizada, fila y número; los pases multi sesión conservan ese asiento. No convertir automáticamente eventos con pedidos a numerados. La clave QR debe conservarse; sustituirla invalida la reconstrucción de los QR emitidos.

Estado: implementado y verificado. Cambios aditivos; ventas y eventos existentes conservados. Sin publicación ni commits.

## Evidencia

- Migración `0012_curious_wasp.sql` aplicada: tabla `order_item_seat` con clave por ítem/unidad, unicidad de posición por ítem y referencias/validaciones.
- Compra existente «Camilo»: pedido pagado, una unidad, una entrada recuperada. No se repitió el cobro ni se cambió la modalidad de pie.
- Evento identificado de prueba: 25 asientos numerados, filas A/B/C de 10/10/5, máximo seis por compra. Comprobado en navegador: A-1/A-2/A-3 → S/ 30. No se efectuó una compra durante esa comprobación.
- Suite completa: 221 pruebas, 47 archivos, sin fallos. TypeScript, ESLint, compilación de producción y revisión de código sin errores materiales.
- Comprobación de aislamiento: comprador ajeno y token de invitado incorrecto no obtienen entradas; tres unidades → tres credenciales/QR distintos; repetir emisión conserva las mismas entradas.
- Navegación sin sesión a `/mis-compras` redirige a Clerk con retorno a esa sección. La vista autenticada se verificó mediante pruebas de consulta y componentes; no se inició sesión en nombre del usuario.

## Operación

`QR_SIGNING_SECRET` es una clave privada hexadecimal de 32 bytes, configurada localmente en `.env.local`. Conservarla en los despliegues y respaldos: los hashes almacenados no permiten reconstruir credenciales con una clave diferente. Nunca usar un prefijo `NEXT_PUBLIC_` ni exponerla al cliente.

El pago válido emite entradas dentro de la misma transacción que convierte el inventario. Una configuración QR ausente hace fallar esa transacción y permite reintento del inbox. `scripts/backfill-paid-tickets.ts` recupera de forma idempotente unidades faltantes de pedidos pagados con pago exitoso e inventario convertido.

El mapa de filas es un esquema según la configuración del organizador; no reproduce la geometría arquitectónica del recinto. El enlace de ubicación consulta el nombre, dirección y ciudad del evento. Las modalidades de pie, asiento libre y box no reciben un asiento numerado ficticio.
