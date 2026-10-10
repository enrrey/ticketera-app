# Estadios, tribunas y bloqueo al seleccionar

Solicitud del usuario: 9 octubre 2026. Amplía el flujo de asientos existente siguiendo su imagen de referencia.

El organizador selecciona un recinto de su catálogo o introduce uno nuevo; habilita el plano, selecciona plantilla de estadio/teatro/personalizado y posición del escenario. Cada tipo de entrada define una tribuna/zona, ubicación dentro del plano, modalidad, filas, asientos y precio. Los mismos datos generan la vista previa del organizador y el plano público. Las plantillas son esquemas configurables, no planos certificados de un estadio ni aforos oficiales.

Seleccionar un asiento solicita un bloqueo privado en el servidor por 60 segundos. El token se guarda en sessionStorage y se transmite por header/body privados, nunca URL. Se muestra contador; deseleccionar libera únicamente bloqueos propios. Al vencer se libera lógicamente sin depender de cron. El mapa consulta disponibilidad periódicamente sin PII. La reserva del pedido convierte esos bloqueos atómicamente y mantiene el flujo de pago seguro ya existente (15 minutos y cierre/reconciliación de Stripe antes de liberar).

Reglas: precio, aforo y coordenadas se validan en servidor; bloqueos por evento/zona/fila/asiento, transacciones serializadas por evento. Nadie puede reservar/liberar bloqueos de otro comprador. Eventos con compras conservan configuración vendida. Edición con bloqueos activos rechazada para evitar reinterpretar selecciones. Ventas existentes preservadas. Compatibilidad con clientes antiguos: compra directa de asiento libre sigue revalidándose, pero jamás consume un bloqueo ajeno.

Aceptación: recinto/tribunas/aforo dibujados desde datos persistidos, selección real con 60 segundos, ocupado en otro cliente, liberación por vencimiento/deselección, transición a pedido sin ventana de doble venta, conservación de QR por unidad, mapas responsivos y accesibles con estados claros, pruebas de aislamiento/concurrencia y referencias primarias.

Referencias: https://docs.seats.io/docs/api/hold-tokens/ ; https://docs.seats.io/docs/renderer/config-session/ ; https://docs.seats.io/docs/tutorial/submit-hold-token/ ; https://docs.stripe.com/api/checkout/sessions/expire . No contratar un proveedor externo para esta implementación.
