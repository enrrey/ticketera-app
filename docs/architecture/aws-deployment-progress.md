# Despliegue de la demo AWS

Fecha de inicio: 2026-10-16. Diseño autorizado: [aws-demo.md](aws-demo.md).

## Plan y límites

1. Confirmar cuenta, crédito, región y cuotas sin modificar recursos.
2. Crear ECR, rol de ejecución y logs con retención de tres días.
3. Construir la imagen localmente y probar el contenedor antes de publicarlo.
4. Crear Lambda con 1 GiB, timeout de 30 segundos y concurrencia reservada (propuesta inicial 2; valor validado en navegador 5); sin VPC ni concurrencia provisionada.
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
- [x] Imagen Linux construida y probada.
- [x] Lambda, alias y URL pública autorizada.
- [x] Comprobaciones remotas mediante invocaciones autenticadas.
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

## Instalación y validación completadas

- GitHub CLI autenticado oficialmente como `enrrey`; no se reutilizó el token del gestor de Git. Repositorio público.
- Commit `ed202bf` publicado en `main`. CI [38995825675](https://github.com/enrrey/ticketera-app/actions/runs/38995825675): lint, generación de tipos Next, TypeScript, **338 pruebas en 72 archivos** y build aprobados. Se corrigió el orden de CI: `next typegen` antes de `tsc`, necesario para `LayoutProps` en un checkout limpio.
- [Compilación de imagen 38995828040](https://github.com/enrrey/ticketera-app/actions/runs/38995828040) aprobada, incluyendo arranque Linux con filesystem de solo lectura y `/tmp` escribible. Artefacto privado de configuración: ninguno; solo claves públicas sandbox y datos sintéticos en la prueba.
- La imagen se descargó y publicó con `crane` v0.22.1 desde su release oficial, con checksum verificado. Login estándar de ECR usando contraseña temporal; su archivo de autenticación se eliminó al finalizar.
- Imagen ECR `ticketera-demo:bootstrap-ed202bf-38995828040`, digest `sha256:a50c0916ae4685e69ae5c248058cf57aca01d5b588a69922b3f9b14f3281f28f`, tamaño registrado 114100235 bytes (aprox. 109 MiB). Mantener una sola imagen inicial.
- Lambda `ticketera-demo`, versión **2**, alias **demo**: activa, 1024 MiB, timeout 30 segundos, concurrencia reservada **5** (inicialmente 2; ajuste validado en navegador), `/tmp` 512 MiB, sin VPC ni concurrencia provisionada. La versión 1 es un paso de bootstrap con APP_URL provisional; no usarla como rollback funcional.
- URL estable: `https://fpskq5ovziao23pldimhdimskm0zqdav.lambda-url.us-east-2.on.aws/`.
- Inicialmente la URL usó AWS_IAM y se comprobó su 403 anónimo. Posteriormente el usuario autorizó expresamente su apertura: el estado actual es AuthType NONE, con permisos limitados a Function URL, descritos debajo.
- APP_URL ya coincide con esa URL. Las variables privadas están solo en Lambda, nunca en la imagen o GitHub. Correos forzados a false. Se omitieron deliberadamente ambos secretos de webhook: deben corresponder a los nuevos endpoints remotos, no al listener local.
- La API Free Tier reportó posteriormente **USD 120 disponibles**, todavía plan FREE activo. Mantener el objetivo de diseño basado en USD 100 y menos de USD 10/mes; los datos de facturación no son instantáneos.

### Pruebas sobre la versión desplegada

Invocaciones autenticadas de Lambda con eventos HTTP v2, sin compras ni pagos:

| Ruta | Resultado |
|---|---|
| GET `/api/health` | 200, `status: ok` |
| GET `/` | 200 |
| GET `/api/events` | 200, dos eventos publicados desde Neon |
| GET `/api/events?scope=organizer` sin sesión | 401 |
| GET `/api/admin/users` sin sesión | 401 |
| GET `/ingresar` | 200 |
| GET `/organizador` sin sesión | 307 a ingreso |
| POST `/api/webhooks/stripe` sin configurar | 503, cerrado |
| POST `/api/webhooks/clerk` sin configurar | 503, cerrado |

Estas verificaciones no prueban OAuth en el navegador, selección/compra, 3DS, webhook ni emisión de entradas remotas. Esos pasos esperan la apertura autorizada de la URL y la configuración del proveedor. El procesador financiero permanece detenido.

## Pausa y reanudación manual

Pausar la ejecución fuera de las sesiones de prueba:

```powershell
aws lambda put-function-concurrency --function-name ticketera-demo --reserved-concurrent-executions 0 --profile ticketera --region us-east-2
```

Reanudar con el límite validado en navegador:

```powershell
aws lambda put-function-concurrency --function-name ticketera-demo --reserved-concurrent-executions 5 --profile ticketera --region us-east-2
```

Con concurrencia cero las peticiones se rechazan; no se borran datos y el almacenamiento ECR sigue existiendo. No cambiar el plan gratuito, activar características avanzadas ni retirar políticas para solucionar CD. El presupuesto mensual de USD 10 no pausa automáticamente Lambda.

## Apertura pública autorizada

El usuario autorizó explícitamente el acceso público el 2026-10-16. Se cambió el AuthType del alias `demo` de AWS_IAM a NONE y se agregaron dos permisos sobre **ese alias**:

- `lambda:InvokeFunctionUrl`, condicionado a `lambda:FunctionUrlAuthType=NONE`.
- `lambda:InvokeFunction`, condicionado a `lambda:InvokedViaFunctionUrl=true`; no permite Lambda Invoke anónimo por otros medios.

No se cambiaron roles de aplicación, credenciales, plan, presupuesto ni workers. La concurrencia inicial de 2 produjo 19 errores 429 al cargar CSS, fuentes y scripts en paralelo en un navegador nuevo. Se ajustó a 5; la siguiente carga con una sesión nueva pasó sin errores de consola. Sigue sin concurrencia provisionada ni costo de cómputo en reposo; el límite no equivale a un tope monetario.

Comprobaciones HTTP por la URL real: `/api/health`, `/`, `/ingresar` y `/api/events` responden 200 (dos eventos); APIs de organizador/admin sin sesión responden 401; `/organizador` redirige con 307; webhook Stripe sin secreto remoto devuelve 503. La prueba autenticada anterior sigue siendo evidencia adicional de la versión 2. La URL ya no debe devolver 403 a visitantes por falta de firma AWS.

Revisión visual con Playwright, sesión nueva y viewport 1440×900: landing con estilos, scripts e imágenes correctos, cero imágenes rotas y cero errores de consola; queda el aviso esperado de Clerk por claves de desarrollo. `/ingresar` carga el widget real con `Continue with Google` y campo de correo. No se inició sesión con la cuenta del usuario, no se creó una compra y no se ejecutó el procesador financiero. Captura local ignorada: `output/playwright/aws-landing.png`.

## Pendientes exactos

1. Prueba del login Clerk con una cuenta del usuario; el formulario y sus recursos ya se verificaron visualmente. Ajustar las opciones de desarrollo/orígenes del proveedor solo si hace falta.
3. Crear endpoint Stripe sandbox `https://fpskq5ovziao23pldimhdimskm0zqdav.lambda-url.us-east-2.on.aws/api/webhooks/stripe`, guardar el nuevo signing secret directamente en configuración segura y probar la entrega firmada. No reutilizar el secreto local.
4. Configurar el endpoint Clerk remoto si se van a probar sus eventos.
5. Autorizar por separado cualquier ejecución del procesador de pagos que pueda expirar reservas o reembolsar operaciones de prueba.
6. CD OIDC sigue restringido por AWS Projects. CI y build manual funcionan; no se presenta el despliegue automático como operativo.

Fuentes: [regiones de AWS Projects](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html), [políticas administradas](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).
