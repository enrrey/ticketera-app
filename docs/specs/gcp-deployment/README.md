# Preparación de despliegue GCP

Estado: empaquetado local y CI preparados; producción pendiente de proyecto, dominio y política de retención. Región aprobada: `southamerica-east1`. No se han creado recursos ni publicado imágenes. Este documento complementa las decisiones de `docs/specs/ticketing-system-design/spec.md` y no cambia la política del negocio.

## Imagen local

Requiere Docker con motor Linux activo y `output: "standalone"` en `next.config.ts`. El Dockerfile usa Node 24, instala desde el lockfile y copia únicamente el servidor standalone, sus dependencias trazadas y archivos estáticos a la etapa final. Ejecuta como usuario `node`, escuchando `0.0.0.0:8080`; Cloud Run puede inyectar `PORT`. No inicia migraciones ni workers automáticamente.

```powershell
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k -t ticketera:local .
docker run --rm -p 8080:8080 --env-file .env.local ticketera:local
```

La clave del ejemplo es ficticia: permite probar compilación, pero no autenticar usuarios. Para probar autenticación use la clave pública de Clerk de desarrollo. Para cada ambiente reconstruya con sus valores públicos reales de `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y, si se usa, `NEXT_PUBLIC_APP_URL`. Estos valores se incorporan al JavaScript del navegador. Los secretos de servidor se inyectan al ejecutar; no son argumentos de build. `.dockerignore` excluye `.env*`, Git, dependencias locales y tests; conserva lockfile, código, scripts y migraciones necesarios para la comprobación TypeScript.

CI ejecuta instalación reproducible, lint, typecheck, Vitest con dos workers y build. No contiene credenciales privadas, URL de base remota, llamadas de verificación Stripe, migraciones ni despliegues. Los tests de servicios usan dobles y la persistencia de pruebas existente; el pipeline no aprovisiona PostgreSQL.

## Recursos y configuración a preparar tras definir los datos faltantes

- Artifact Registry y Cloud Run en `southamerica-east1`, con cuenta de servicio propia. Publicar una imagen identificada por digest y promover el mismo artefacto validado. Configurar dominio y HTTPS, `APP_URL`, redirecciones Clerk y destinos de webhooks Clerk/Stripe con firmas verificadas.
- Cloud SQL PostgreSQL en la misma región, con backups automáticos y PITR habilitados explícitamente. Aprobar duración de retención, RPO/RTO, disponibilidad y presupuesto antes de crear la instancia. Probar restauración en una instancia aislada antes de lanzamiento y periódicamente. No asumir que PITR esté activado por defecto.
- Conectar Cloud Run mediante la integración Cloud SQL y socket `/cloudsql/INSTANCE_CONNECTION_NAME`. El `pg.Pool` actual acepta una URL PostgreSQL con parámetro `host` URL-encoded apuntando al socket. Dar `roles/cloudsql.client` a la cuenta de ejecución. El proxy integrado cifra y autentica el tramo remoto con TLS; el tramo local usa socket Unix. Si se decide conexión TCP directa, exigir TLS con validación de CA/identidad y, según el modo elegido, certificado cliente; no usar `rejectUnauthorized: false` ni asumir que IP privada implica TLS. Validar compatibilidad del modo CA con la generación de Cloud Run elegida. [Conexión oficial](https://docs.cloud.google.com/sql/docs/postgres/connect-run), [TLS](https://docs.cloud.google.com/sql/docs/postgres/configure-ssl-instance).
- Secret Manager para `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_JOBS_SECRET`, `QR_SIGNING_SECRET` y `RESEND_API_KEY`. Usar versiones explícitas y acceso por secreto para la cuenta de ejecución. `RESEND_FROM_EMAIL` requiere dominio verificado. Rotar versiones con nueva revisión y validar integraciones antes de retirar la anterior. No exportar archivos de credenciales de cuentas de servicio.
- El pool actual limita cada instancia a cinco conexiones. Definir `max-instances` y concurrencia a partir de la capacidad Cloud SQL dejando conexiones para migraciones/operación. Ejecutar migraciones desde un proceso separado y autenticado con acceso a DB; la imagen standalone no incluye el CLI de Drizzle. No ejecutarlas al arrancar cada réplica.

## Scheduler y ruta interna protegida

La operación existente es `POST /api/internal/payment-jobs`: procesa inbox de webhooks, reservas vencidas, reembolsos y outbox de correo. Requiere `Authorization: Bearer PAYMENT_JOBS_SECRET` y rechaza sin secreto (503) o credencial incorrecta (401). Conservar este control aun cuando exista IAM en infraestructura.

Cloud Run aplica IAM al servicio completo, no a una ruta. El servicio web público necesita recibir compradores y webhooks; añadir un token OIDC de Scheduler a ese servicio público no impone IAM a `/api/internal/payment-jobs`. Tampoco sustituye el bearer que comprueba el código. No enviar `PAYMENT_JOBS_SECRET` como cabecera estática guardada en la configuración de Scheduler.

Preparar un dispatcher privado separado (Cloud Run o función): Scheduler autentica con OIDC y audiencia igual a la URL del dispatcher; su cuenta tiene `roles/run.invoker` únicamente sobre ese servicio. El dispatcher lee `PAYMENT_JOBS_SECRET` de Secret Manager y llama exclusivamente al POST interno de la web con el bearer. Restringir el dispatcher a esta operación, sin aceptar destino arbitrario del solicitante. Nunca registrar cabeceras/secretos. Este dispatcher y el job todavía no están implementados ni aprovisionados; son un requisito pendiente antes de producción. [Scheduler con Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler), [autenticación HTTP](https://docs.cloud.google.com/scheduler/docs/http-target-auth).

Definir frecuencia, timeouts y reintentos tras medir el tiempo de ejecución. La ruta declara `maxDuration = 300`; configurar Cloud Run y el dispatcher de forma consistente. Verificar que un reintento no duplique efectos y que trabajos pendientes sobrevivan reinicios. No depender de timers en una instancia que Cloud Run puede suspender.

## Verificación y salida a producción

Antes de habilitar tráfico: pruebas locales/CI verdes, build y arranque Docker verificados, secretos correctos por ambiente, migraciones revisadas, restauración/PITR probados, OAuth/webhooks firmados, rechazo de jobs sin credencial, Scheduler invocando dispatcher autenticado, comprobación funcional de compra/reembolso/correo con cuentas de prueba y métricas/alertas para fallos y backlog. Mantener una revisión anterior para rollback de aplicación; una migración necesita su propia estrategia de compatibilidad y recuperación.

No se ejecutan comandos de producción en esta preparación. Faltan identificador de proyecto, dominio, retención/RPO/RTO, dimensionamiento y la implementación del dispatcher. Validación local del motor Docker: el cliente está instalado, pero el socket `dockerDesktopLinuxEngine` no está disponible; no se ha confirmado build ni arranque del contenedor.
# Pospuesto por el usuario

El 2026-10-12 el usuario decidió dejar Google Cloud para después y probar primero el flujo local. Estos archivos son preparación sin despliegue. Dockerfile y .dockerignore están guardados en `templates/`: al retomar, copiar ambos a la raíz antes de seguir los comandos de esta guía. `output: "standalone"` todavía no está activado; el Dockerfile no se declara listo ni probado hasta retomar y verificar esa configuración.
