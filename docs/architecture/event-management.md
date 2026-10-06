# CRUD de eventos

En `/organizador` (también accesible desde `/organizer`) se puede crear un borrador, consultar detalles, editar datos y sesiones, publicar/cancelar y confirmar la eliminación. `/organizador/eventos/nuevo` utiliza el mismo formulario real. No crea entradas ni simula ingresos.

Cada operación consulta Clerk y verifica rol de equipo, cuenta activa y `events.manage`; las transacciones vuelven a consultar los permisos actuales. Organizadores gestionan solamente eventos propios; administradores y super admin gestionan todos. Los clientes solo consultan publicados por la API pública y las rutas de detalle; no reciben estadísticas ni pueden modificar eventos. El servidor no admite `organizerId`, roles, slug ni creador como campos del formulario. Todas las escrituras exigen Origin del propio sitio, JSON válido y validación estricta.

Los eventos se crean como draft. Todas sus sesiones deben comenzar después del momento actual, terminar después del inicio y no superponerse. El formulario convierte explícitamente horario de Perú a ISO; la fecha de vencimiento corresponde al fin de las sesiones. Publicar exige `events.publish` y dirección confirmada. Un publicado no vuelve a draft; cancelados y finalizados mantienen su historial y son de solo lectura.

No se modifica ni elimina un evento con pedidos, incluidos pendientes. Solo se eliminan draft sin pedidos, promociones ni liquidaciones, junto con sus sesiones y tipos de entrada sin ventas. Sesiones con tipos de entrada configurados se conservan. Los tipos de entrada se bloquean antes de revisar pedidos, para evitar carreras con las claves foráneas de nuevos checkouts. Los cambios de recinto generan una ficha separada para preservar otros eventos que compartan el recinto. Cada creación, edición o eliminación genera auditoría.

La portada se ingresa, cambia o retira mediante una URL HTTPS pública, con vista previa. Incluso si existen pedidos, se permite una actualización limitada exclusivamente a la portada; las condiciones de las entradas permanecen protegidas. No se suben archivos ni se descargan imágenes remotas desde el servidor.

El formulario configura tipos de entrada por zona: espacio de pie, asiento libre, asiento numerado o mesa/box. Cada tipo guarda precio en céntimos de PEN, capacidad, límite por pedido, personas por unidad, descripción, ventana de venta y sesiones incluidas. Los asientos numerados definen filas y cantidad de asientos; su suma debe coincidir con la capacidad. La configuración no emite entradas ni asigna asientos a compradores.

Publicar exige tipos de entrada con ventas vigentes y cobertura de todas las sesiones. Al editar sesiones se actualizan explícitamente sus relaciones con entradas. Los identificadores de entradas ajenas son rechazados y los tipos utilizados por promociones no se eliminan. También se guardan edad mínima e instrucciones de ingreso.

Las migraciones 0006 y 0007 son aditivas y conservan filas existentes con valores por defecto. Los clientes anteriores pueden omitir la configuración para conservarla, pero no modificar sesiones sin actualizar sus relaciones. Un rollback de aplicación conserva estas columnas y sus datos; no requiere eliminarlos.

## Destacados y publicación

La columna event.featured se agrega en 0008 con default false. Solo cuentas activas admin/super_admin con events.manage pueden cambiarla. PATCH {featured:boolean} actualiza exclusivamente esa marca y registra auditoría, sin modificar entradas ni pedidos. El formulario admite la marca y, para eventos con pedidos, solo portada y destacado; los organizadores no pueden cambiarla. La estrella del listado y la casilla del editor persisten la misma selección. La consulta pública continúa exigiendo published, por lo que destacar un borrador nunca lo publica. El hero usa exclusivamente los destacados persistidos, en cualquier ciudad. Las opciones de ciudad y mes se derivan de los eventos reales publicados.

Los filtros y formularios utilizan controles de 40px y Calendar de shadcn con locale español. Las fechas y horas se configuran separadas y siguen representando horario de Perú. La hoja de edición ocupa hasta 680px y se adapta al ancho móvil. Crear evento se mantiene en el listado, no en el sidebar. El login del panel conserva un destino interno validado; nunca acepta redirecciones externas.
