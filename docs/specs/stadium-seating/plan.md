# Plan

1. Persistir plantilla del evento, posición de tribuna y bloqueos temporales. Migración aditiva con activación compatible de eventos numerados existentes.
2. Bloqueos de 60 segundos: API protegida por origen y token, ocupación pública, validación de filas/zonas/cantidad; convertir a pedido en la transacción existente.
3. Plano compartido y selector por tribuna inspirado en la referencia: estados, zoom/desplazamiento, accesibilidad, límites de renderizado. Contador y actualización de disponibilidad en comprador.
4. Editor de recinto/plantillas/tribunas y vista previa común; conservar seguridad y configuración comprada.
5. Revisar carreras con edición/pago, pruebas enfocadas y suite final, migrar datos reales sin resetear ventas y verificar la interfaz.

Propiedad: root esquema/migraciones/backend checkout; agente plano componentes compartidos y UI checkout; agente editor módulo events. Barrels globales y dependencias root salvo seating/index.ts propiedad agente plano. Sin commits ni publicación.
