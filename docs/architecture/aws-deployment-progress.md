# Despliegue de la demo AWS

Fecha de inicio: 2026-10-16. Diseño autorizado: [aws-demo.md](aws-demo.md).

## Plan y límites

1. Confirmar cuenta, crédito, región y cuotas sin modificar recursos.
2. Crear ECR, rol de ejecución y logs con retención de tres días.
3. Construir la imagen localmente y probar el contenedor antes de publicarlo.
4. Crear Lambda con 1 GiB, timeout de 30 segundos y concurrencia reservada de 2; sin VPC ni concurrencia provisionada.
5. Crear alias `demo` y URL HTTPS. Cargar únicamente variables necesarias desde los archivos locales, sin incluirlas en imágenes, Git ni salidas.
6. Comprobar salud, landing, catálogo y protección de rutas. Entregar URL para configurar el webhook Stripe sandbox; no copiar el secreto del listener local como secreto remoto.
7. Conectar GitHub Actions con OIDC y límites de permisos cuando la autenticación GitHub esté disponible.
8. Registrar recursos, pruebas, pasos de pausa y pendientes.

No ejecutar semillas, migraciones, reembolsos, workers de pagos ni envíos. No activar servicios opcionales, características avanzadas, plan de pago, aumentos de cuota o cambios en las políticas administradas por AWS.

El objetivo operativo es menos de $10 al mes en pruebas ligeras, conservando margen de los $100 para tres meses; no es una garantía de precio. Las alertas de presupuesto no son un corte de facturación. Pausar Lambda fuera de las pruebas y mantener pocas imágenes ECR. No se aprueba ningún cargo adicional ni una suscripción.

## Evidencia y decisiones

- Plan FREE activo; API Free Tier devuelve USD 100 disponibles y vencimiento 2027-04-15 03:09 UTC (2027-04-14, Lima).
- Cuenta del proyecto termina en 8225; usuario CLI `ticketera-cli`.
- La nueva experiencia AWS Projects administra la organización y asigna región según país. Para Perú se documenta `us-east-2`. Las consultas de Lambda y ECR funcionan en Ohio; la denegación anterior en Virginia no requería cambiar políticas.
- Lambda informa cuota regional 400, cero funciones; ECR no contiene repositorios.
- Las claves privadas/públicas Clerk y Stripe locales son de sandbox; las variables necesarias ocupan menos de 4 KiB. No se registran sus valores.
- GitHub CLI todavía no está autenticada; Git push funcionó anteriormente mediante el gestor de credenciales de Git.
- Docker Desktop estaba apagado; se solicitó su inicio local.

## Progreso

- [x] Revisión inicial y diagnóstico de región.
- [x] ECR / IAM / CloudWatch.
- [ ] Imagen Linux construida y probada.
- [ ] Lambda, alias y URL.
- [ ] Comprobaciones remotas.
- [ ] GitHub OIDC / CD.
- [ ] Webhook Stripe remoto: pendiente de la URL y configuración del usuario.

### Recursos instalados

Todos en `us-east-2` salvo IAM, que es global:

- ECR privado `ticketera-demo`, AES256, etiquetas inmutables, sin escaneo de pago habilitado.
- CloudWatch `/aws/lambda/ticketera-demo`, retención tres días.
- Rol `ticketera-demo-runtime`, trust únicamente Lambda; política inline para crear streams y escribir eventos solo en ese grupo.
- AWS Budgets `ticketera-demo-monthly-10-usd`, mensual USD 10, excluye créditos/reembolsos para ver consumo bruto. Sin correos ni acciones automáticas; no es un límite duro.

### Bloqueos restantes

- Docker no puede arrancar: WSL indica que no encuentra su kernel Linux. No se actualizaron componentes de Windows.
- Primer intento de autorización de GitHub CLI falló por red al recoger el token; no quedó autenticado aunque el usuario autorizó en el navegador. Reintento pendiente.
- Segundo intento tampoco confirmó autenticación después de la autorización del usuario; se canceló el proceso pendiente. La revisión automática rechazó reutilizar el token del gestor de credenciales de Git; esa acción no se ejecutó. Continuar con el flujo oficial de GitHub CLI en la terminal del usuario.
- `iam:ListOpenIDConnectProviders` está denegado por la política administrada `p-zhw8zo4v`, distinta del bloqueo regional anterior. No se intentó alterar o eludir esa política.
- La activación de características avanzadas requiere actualizar el plan, es irreversible y retira los límites de gasto de Projects. No está autorizada. Mantener el plan gratuito y el despliegue inicial manual; CD mediante OIDC permanece pendiente.

Siguiente paso: construir la imagen en GitHub sin credenciales AWS, descargar el resultado y publicarlo desde el equipo con su perfil autorizado. Evitar guardar access keys permanentes en GitHub.

Se preparó `.github/workflows/build-demo-image.yml`: ejecución manual, imagen Linux amd64, smoke test de archivo estático con filesystem de solo lectura y datos privados ficticios, artifact con retención de un día. YAML analizado correctamente; aún no se subió ni ejecutó. No comprueba pagos o base de datos.

El perfil local `ticketera` ya tiene `us-east-2` como región predeterminada. CloudWatch confirma retención de tres días y cero bytes almacenados al terminar la revisión inicial.

Fuentes: [regiones de AWS Projects](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html), [políticas administradas](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).
