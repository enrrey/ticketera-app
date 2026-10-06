# Review — Checkout (orden pendiente y reserva de inventario)

Spec: `docs/specs/checkout/spec.md` · Fecha: 2026-10-05 · **Tipo: autorrevisión del implementador, no una revisión independiente.** El flujo SDD prevé el agente `reviewer`; no se ejecutó. Recomendado correrlo antes de dar por cerrada la tarjeta.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | sin errores |
| `npm run lint` | sin errores ni avisos |
| `npm test -- --maxWorkers=1` | 37 archivos, 180 tests pasan (antes 141) |
| `npm run build` | compila; aparecen `/api/checkout`, `/api/checkout/[orderId]`, `/pedidos/[orderId]` |
| `npm run verify:checkout` (PostgreSQL real, esquema temporal) | PASSED — ver abajo |
| Migración `0009` aplicada a la base de desarrollo | columna `order.access_token_hash` nullable + restricción única; 29 tablas, 0 pedidos; `db:generate` sin cambios |

## Criterios de aceptación

| CA | Estado | Evidencia |
| --- | --- | --- |
| 01, 02 | Cumple | `createCheckout.test.ts`: una orden/ítem/reserva por línea, 15 min exactos, precios desde BD; el esquema estricto rechaza `priceCents` |
| 03 | Cumple | miembro → `user_id` de la sesión; invitado → `NULL`; `userId` en el cuerpo → `400` (schema y handler) |
| 04 | Cumple | normalización conserva puntos y `+` |
| 05, 06 | Cumple | `404` evento no publicado/ajeno/inexistente; `409 sales_closed` fuera de ventana, venta futura o sin sesión futura |
| 07 | Cumple | cantidad 0/decimal/> `max_per_order`, duplicados, 11 líneas, vacío, campos extra |
| 08 | Cumple | cuenta inactiva `403`; origen ausente/ajeno `403` sin tocar nada |
| 09, 13 | Cumple | converted y active vigentes cuentan; released y vencidas no; el cupo vuelve solo con el tiempo |
| 10 | Cumple | multi-línea con una sin cupo: nada se escribe, `409` con cupo restante |
| 11, 12 | **Cumple con concurrencia real** | 40 conexiones por 10 unidades → 10 éxitos / 30 `insufficient_inventory`, 10 unidades reservadas; 30 órdenes con orden de tipos opuesto → 30 éxitos sin interbloqueo; mixtas con tipo agotado → fallan limpiamente. Los tests PGlite del mismo nombre prueban solo la lógica (una conexión) |
| 14 | Cumple | test compara el listado público con la función de reserva |
| 15–17, 19 | Cumple | `TicketCheckout.test.tsx`, `OrderSummary.test.tsx`: topes, errores sin perder datos, resumen con cuenta regresiva (reloj del servidor), vencida, sin acción de pago, Agotado/Venta cerrada deshabilitados |
| 18 | Cumple | `getCheckout.test.ts` y `OrderPage.test.tsx`: token en cabecera (nunca en la URL), `404` idéntico ante token erróneo, otro usuario o id inexistente |
| 20 | Cumple parcialmente | etiquetas, `role="alert"`, `role="timer"` con `aria-live="off"` y estado asistivo que cambia solo al vencer, entradas numéricas operables por teclado. **No se probó en un navegador real ni con un lector de pantalla**; el responsive no se verificó visualmente |
| 21 | Cumple | typecheck, lint, tests y build pasan |
| 22 | Cumple | el correo no va en URLs; el token solo en el fragmento y en una cabecera; los errores 503 son genéricos (test con credencial simulada) |

## Hallazgos durante la implementación

- **Bug corregido:** Drizzle emite `"id"` sin prefijo en selects de una sola tabla; dentro de subconsultas se resolvía contra la tabla equivocada y marcaba toda venta como cerrada. Las fórmulas usan nombres calificados; documentado en `docs/architecture/checkout.md`.
- **Riesgo evitado en la verificación real:** las migraciones fijan `"public".` en sus claves foráneas, así que un esquema temporal habría apuntado a tablas reales. El script las reescribe y se niega a correr si queda alguna referencia a `public`. Verificado después: 0 esquemas temporales y 0 filas de prueba en las tablas reales.
- **Operación:** el pooler de Neon no conserva `search_path` y `drizzle-kit migrate` salió con código 1 sin mensaje contra la URL con pooler; con el endpoint directo funcionó.

## Deuda y límites declarados (no son defectos de esta entrega)

- Sin tope de órdenes pendientes ni rate limiting: un tercero puede retener cupo (tarjeta 16, decisión P2).
- El `POST` no es idempotente ante doble envío; la UI deshabilita el botón (la idempotencia llega con el pago, tarjeta 04).
- Hasta la tarjeta 05 hay órdenes `pending` vencidas que no cambian de estado.
- Tres copias de verificación de `Origin` (`staffApi`, `eventManagement`, `sameOrigin`) → unificar en la tarjeta 16.

## Veredicto del implementador

**APROBADO CON RESERVAS:** funcionalmente completo y verificado, salvo la accesibilidad en navegador real (CA-20) y la ausencia de una revisión independiente.
