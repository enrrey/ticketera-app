# Seed manual de eventos

El seed se ejecutó por solicitud del usuario: creó 14 eventos en borrador para `rreyes_ica@sunarp.gob.pe`. El panel del organizador y el catálogo público consultan ahora la base de datos; los borradores no aparecen en el catálogo público.

Cuando se autorice cargar esos datos, ejecutar explícitamente:

```sh
npm run db:seed:events
# También permite varios correos para repartir aleatoriamente cada evento nuevo:
npm run db:seed:events -- --organizer-email=correo1@example.com --organizer-email=correo2@example.com
# Compatible con selección explícita por UUID:
npm run db:seed:events -- --organizer=<uuid-real-del-organizador>
```

El comando lee `DATABASE_URL` del entorno, `.env.local` o `.env`, en ese orden de prioridad. Requiere migraciones aplicadas y usuarios existentes, activos, sin archivar y con rol `organizer`. No crea usuarios ni asigna roles. Por defecto selecciona `rreyes_ica@sunarp.gob.pe`; con varios correos elige aleatoriamente uno para cada evento nuevo como organizador y creador.

Importa las 14 fichas del catálogo como `draft`, con slug igual al ID estable del mock. Reutiliza recintos por nombre y ciudad exactos. Las direcciones desconocidas se marcan `Pendiente de confirmación`; no se inventan coordenadas. Importa 15 sesiones: Hombres G tiene una por cada fecha, 29 y 30 de octubre inclusive.

Los mocks sólo conocen fechas. Cada sesión usa provisionalmente 20:00–23:00 en `America/Lima` (UTC−05:00); la descripción identifica explícitamente este dato pendiente. Si la fecha original ya pasó o es hoy, la nueva importación comienza mañana y conserva la duración en días. Antes de publicar, confirmar horario y dirección y configurar entradas, precios y aforo. No crea tipos de entrada, inventario, reservas, pedidos, entradas emitidas ni datos de venta. La ejecución verificada conserva 0 pedidos, 0 entradas y 0 ingresos.

La operación es transaccional y serializa ejecuciones del importer mediante un advisory lock. Repetirla omite eventos cuyo slug ya existe para el mismo organizador, sin cambiar sus modificaciones posteriores ni duplicar sesiones. Si un slug pertenece a otro organizador, aborta toda la transacción. No reasigna eventos ni repara sesiones de eventos existentes; esas tareas requieren una operación separada y explícita.

Las pruebas usan PGlite en memoria y las migraciones SQL del proyecto; nunca utilizan `DATABASE_URL`.
