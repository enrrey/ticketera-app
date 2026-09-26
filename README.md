# Next.js Template

Template base para arrancar proyectos con Next.js 16, pensado para trabajar con agentes de IA siguiendo **Spec Driven Development**. No está atado a ningún dominio de negocio: trae el stack, las convenciones de estructura y el flujo de trabajo ya definidos.

## Stack

| Área | Elección |
| --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack, carpeta `src/`) |
| UI | **React 19** + **Tailwind CSS v4** (CSS-first, sin `tailwind.config`) |
| Lenguaje | **TypeScript** en modo `strict`, alias `@/*` → `./src/*` |
| Componentes | **shadcn/ui** (estilo `base-nova`, base `neutral`, iconos `lucide-react`) |
| Datos | **axios**, **TanStack Query**, **TanStack Table** |
| Estado | **Zustand** |
| Validación | **Zod** |
| Testing | **Vitest + React Testing Library** (jsdom) |
| Tema | **next-themes** (modo oscuro por clase `.dark`) |
| Lint | ESLint (flat config, `eslint-config-next`) |

## Empezar

```bash
npm install
npm run dev     # http://localhost:3000
```

## Comandos

```bash
npm run dev        # servidor de desarrollo (Turbopack)
npm run build      # build de producción
npm run start      # sirve el build de producción
npm run lint       # ESLint
npm run typecheck  # typecheck rápido, sin build completo
npm test           # tests (una pasada)
npm run test:watch # tests en modo watch
```

## Estructura y convenciones

**`docs/SETUP.md` es la fuente de verdad.** Léelo antes de crear cualquier archivo. En resumen:

- El código se organiza **por módulo de dominio** en `src/modules/<domain>/`, con sus propios `components/`, `hooks/`, `services/`, `types.ts` e `index.ts` (barrel). No se organiza por tipo de archivo.
- `src/app/` contiene **solo rutas** y se mantiene delgado: compone lo que exponen los módulos, sin lógica de negocio.
- Naming: componentes `PascalCase.tsx`, hooks `useThing.ts`, servicios y utilidades `camelCase.ts`, carpetas `kebab-case`, tests `<archivo>.test.ts(x)` junto al archivo que prueban. Todo en inglés.
- Código compartido sin dominio propio: `src/components/ui/` (shadcn), `src/lib/`, `src/hooks/`.
- **SOLID, DRY, KISS y YAGNI** aplican a todo.

### Reutilizar antes de crear

Antes de escribir un componente, hook o función, busca si ya existe algo equivalente —por nombre **y por concepto**— en `src/components/ui/`, `src/lib/`, `src/hooks/` y `src/modules/*/`. Si es UI, comprueba primero si **shadcn/ui** ya lo ofrece. Solo se construye lo que realmente no existe, y se construye reutilizable.

## Metodología: SDD y agentes

El proyecto trabaja con **Spec Driven Development**. Hay cuatro agentes definidos en `.claude/agents/`:

| Agente | Rol |
| --- | --- |
| `orchestrator` | Punto de entrada. Decide **SDD vs. modo build directo**, acota el plan a una sesión, despacha al resto y gestiona el loop de corrección. |
| `spec` | Escribe `docs/specs/<feature>/spec.md`: objetivo, alcance, criterios de aceptación verificables, inventario de reutilización y requisitos de test. No escribe código. |
| `developer` | Implementa **una** tarea del plan, con propiedad exclusiva de archivos. |
| `reviewer` | Valida contra los criterios del spec y `docs/SETUP.md`, escribe `review.md` y emite APROBADO / CAMBIOS REQUERIDOS. No corrige código. |

Specs, planes y reviews viven en `docs/specs/<feature>/`.

> **Aprobación humana obligatoria.** Una spec debe ser aprobada explícitamente por una persona antes de empezar a implementar. `spec.md` nace con estado `PENDIENTE DE APROBACIÓN`; solo el orquestador lo cambia a `APROBADO`, y solo tras un sí humano explícito.

No todo necesita SDD: los cambios pequeños y bien entendidos (un bug con causa conocida, config, textos, ≤2 archivos) van por modo build normal, respetando igual las reglas de estructura y reutilización.

**Trabajo en paralelo.** Dos tareas solo corren a la vez si sus archivos son disjuntos e independientes. Las zonas compartidas (`package.json`/lockfile, `components.json`, configs, `src/app/layout.tsx`, `src/app/globals.css`, barrels `index.ts`) nunca se asignan a agentes paralelos: en particular, los `npm install` se hacen antes y en serie, porque instalaciones concurrentes corrompen el lockfile.

## Skills recomendadas

Estas skills mejoran el trabajo con este template. Las tres primeras ya están instaladas en este entorno:

| Skill | Para qué sirve | Estado |
| --- | --- | --- |
| [`superpowers`](https://github.com/anthropics/claude-plugins-official) | Flujos de proceso: brainstorming, debugging sistemático, TDD, escritura de planes. Encaja directo con SDD. | ✅ Instalada |
| `ponytail` | Fuerza la solución más simple que funciona (YAGNI, stdlib antes que dependencias). Refuerza las buenas prácticas de `docs/SETUP.md`. | ✅ Instalada (`~/.claude/skills/`) |
| `caveman` | Modo de comunicación ultracomprimido; reduce tokens de salida manteniendo precisión técnica. | ✅ Instalada (`~/.claude/skills/`) |
| [`frontend-design`](https://github.com/anthropics/claude-plugins-official) | Skill de Anthropic para implementación de UI/UX. | Disponible en el marketplace oficial |
| [`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Inteligencia de diseño: catálogo de estilos UI, paletas, pares tipográficos y chequeos de accesibilidad (contraste, focus, ARIA). | Requiere instalación |
| [`vercel-plugin`](https://github.com/vercel-labs/vercel-plugin) | Skills de Vercel Labs para Next.js, AI SDK, Turborepo, Functions y middleware. | Requiere instalación |

Instalación:

```bash
# Plugin oficial de Anthropic (el marketplace ya está configurado)
/plugin install frontend-design@claude-plugins-official

# Vercel Labs
npx -y skills add vercel-labs/vercel-plugin --agent claude-code
```

Para `ui-ux-pro-max`, sigue las instrucciones del [repositorio](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (la skill vive en `.claude/skills/ui-ux-pro-max/` e incluye scripts de búsqueda propios).

## Estado actual

El proyecto es todavía un scaffold limpio (`src/app/layout.tsx`, `src/app/page.tsx`). `src/modules/` aparece con la primera feature.

shadcn/ui ya está operativo: tema `neutral` en `src/app/globals.css`, `src/lib/utils.ts` y un primer componente en `src/components/ui/button.tsx`.

### Añadir componentes de shadcn

```bash
npx shadcn@latest add <componente>
```

Funciona siempre que el componente no requiera una dependencia nueva. **No ejecutes `shadcn init`**: el proyecto ya está inicializado y ese comando falla en este entorno por una incompatibilidad con npm 11. Si un `add` falla al instalar dependencias, instálalas desde tu terminal y repite el `add`. Los detalles están en `CLAUDE.md`.

### Modo oscuro

Funciona vía `next-themes` con la estrategia de clase de shadcn (`.dark`), configurado en `src/app/providers.tsx` y siguiendo por defecto la preferencia del sistema. Para un selector de tema, usa el hook `useTheme()` de `next-themes`.

### Tests

Vitest con entorno jsdom (`vitest.config.mts`). Los tests van junto al archivo que prueban, con sufijo `.test.ts(x)` — hay un ejemplo en `src/components/ui/button.test.tsx`.

```bash
npm test                                          # todos
npx vitest run src/components/ui/button.test.tsx  # un archivo
npx vitest run -t "renders its label"             # un test por nombre
```
