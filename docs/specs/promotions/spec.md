# Promociones para Ticketera

Estado: PENDIENTE DE REVISIÓN DEL DISEÑO. Alcance solicitado: tarjeta 10 de Trello.

## Resultado

El organizador administra descuentos de sus eventos; admin/super admin puede administrar todos. El comprador ingresa un código opcional. El servidor calcula y congela descuentos en la orden; nunca acepta precios o descuentos del navegador.

## Reglas propuestas para el MVP

- Promociones automáticas (sin código) o por código normalizado a mayúsculas, único en la plataforma.
- Descuento porcentual de 1 a 99 o importe fijo en céntimos PEN. El descuento fijo se aplica una vez al subtotal elegible de la orden, no una vez por entrada.
- Vigencia, activación, límite opcional por número de órdenes y selección de tipos del mismo evento. Sin selección: todos los tipos del evento.
- Permitir acumular descuentos, según decisión del usuario del 2026-10-12. Aplicar las promociones automáticas elegibles y el código indicado en orden determinista sobre el saldo elegible restante; no permitir un descuento mayor al subtotal ni duplicar la misma promoción. Código inválido, vencido o agotado devuelve error explícito antes de reservar. La distribución y el orden concreto deben quedar definidos antes de implementar.
- Descuento máximo: subtotal elegible menos un céntimo. Las órdenes gratuitas requieren un flujo separado y quedan fuera de este cambio.
- Distribuir el descuento proporcionalmente por línea en céntimos enteros, asignando restos determinísticamente. Conservar `order_item` y `order_promotion` históricos aunque se edite o desactive la promoción.
- El límite cuenta órdenes con pago confirmado (incluidas devoluciones) y reservas pendientes no vencidas. Reservas vencidas sin pago liberan el uso. Bloquear la promoción dentro de la transacción, siguiendo evento → tipos de entrada → promociones, para impedir exceso bajo concurrencia.
- Una promoción usada se desactiva; no se borra su historial. Eliminación física solo si nunca fue aplicada.

## Implementación prevista

Reutilizar las tres tablas de promociones existentes, `events.manage`, la autorización persistida de eventos, componentes shadcn y calendarios actuales. Módulo `promotions` con CRUD privado y servicio transaccional de cálculo; integrar con `createCheckout`, formulario de compra, panel y snapshots de Stripe ya existentes. El resumen definitivo de descuentos lo devuelve el servidor después de crear la orden.

## Aceptación

CRUD con aislamiento entre organizadores; rechazo de origen ajeno y permisos revocados. Código único sin distinguir mayúsculas. Pruebas de vigencia, alcance, cálculo/redondeo, acumulación sin descuentos duplicados ni totales negativos, snapshots inmutables y límite concurrente. Reservas/QR/reembolsos deben conservar sus invariantes actuales. No crear promociones reales durante pruebas; usar base de pruebas.

## Por confirmar en la revisión

El usuario confirmó acumular promociones. Permanece pendiente definir el orden de cálculo y revisar el importe fijo por orden antes de implementar.
