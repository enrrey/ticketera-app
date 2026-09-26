# SETUP.md

Reglas de estructura de carpetas, buenas prácticas de desarrollo y metodología de trabajo para este proyecto.

---

## 1. Estructura de carpetas

### Reglas

- El código se organiza **por módulo de dominio**, no por tipo de archivo. Cada dominio de negocio (ej. `user`, `product`, `order`) vive en su propia carpeta bajo `src/modules/`, y agrupa ahí sus componentes, hooks, servicios y tipos.
- Todos los nombres de carpetas y archivos van **en inglés**.
- Usamos **App Router**: `src/app/` contiene únicamente rutas (`page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts`, etc.). Las rutas son "delgadas" y solo componen/orquestan lo que viene de `src/modules/`; no contienen lógica de negocio ni componentes de UI complejos directamente.
- Naming de TypeScript/React:
  - **Componentes** → `PascalCase.tsx` (ej. `UserCard.tsx`, exporta `export function UserCard()`).
  - **Hooks** → `camelCase.ts` empezando con `use` (ej. `useUser.ts`, exporta `useUser()`).
  - **Servicios / utilidades / funciones** → `camelCase.ts` (ej. `userService.ts`, `formatDate.ts`).
  - **Tipos e interfaces** → `PascalCase`, agrupados en `types.ts` o `<nombre>.types.ts` dentro del módulo.
  - **Carpetas** → `kebab-case` (ej. `user-profile/`).
  - **Tests** → mismo nombre que el archivo que prueban, sufijo `.test.ts` / `.test.tsx` (ej. `useUser.test.ts`).
- Todo módulo debe ser autocontenido y modular: si un módulo necesita algo de otro, se importa explícitamente (nunca se accede a los internos de otro módulo saltándose su punto de entrada).

### Ejemplo

```
src/
  app/
    (dashboard)/
      users/
        page.tsx              # ruta: renderiza <UsersPage /> del módulo user
        [id]/
          page.tsx
    layout.tsx
    globals.css
  modules/
    user/
      components/
        UserCard.tsx
        UserList.tsx
      hooks/
        useUser.ts
        useUsers.ts
      services/
        userService.ts        # llamadas a API (axios) relacionadas a user
      types.ts                 # User, UserDTO, etc.
      index.ts                 # barrel: exporta lo público del módulo
    product/
      components/
        ProductCard.tsx
      hooks/
        useProduct.ts
      services/
        productService.ts
      types.ts
  components/
    ui/                        # componentes de shadcn (no son un "módulo de dominio")
  lib/
    utils.ts                   # cn() y utilidades globales sin dominio propio
  hooks/                       # hooks verdaderamente globales/compartidos entre módulos
```

`src/app/users/page.tsx` solo importa y usa lo que expone `src/modules/user`:

```tsx
import { UserList } from "@/modules/user";

export default function UsersPage() {
  return <UserList />;
}
```

---

## 2. Buenas prácticas

Aplicamos **SOLID, DRY, KISS y YAGNI** en todo momento, sin importar si estamos creando un componente de shadcn, una función utilitaria, un hook o un servicio.

- **SOLID**: cada componente/hook/servicio tiene una única responsabilidad; se depende de abstracciones (props, interfaces) y no de implementaciones concretas cuando eso permite extender sin modificar código existente.
- **DRY**: no se duplica lógica ya existente; se extrae a un hook, servicio o utilidad compartida cuando se repite.
- **KISS**: se prefiere siempre la solución más simple que resuelve el problema actual.
- **YAGNI**: no se construye para necesidades hipotéticas futuras; solo se implementa lo que el requerimiento actual pide.

### Reglas de reutilización (obligatorias antes de crear código nuevo)

1. **Componentes de UI**: antes de crear un componente, verificar si ya existe en [shadcn/ui](https://ui.shadcn.com). Si existe, se instala y usa (ver `components.json` en la raíz). Si no existe en shadcn, se construye a mano, pero siempre pensando en que sea **reutilizable** (props genéricas, sin lógica de negocio acoplada) y se ubica en `components/ui/` si es de propósito general, o en `modules/<domain>/components/` si es específico de un dominio.
2. **Antes de crear cualquier componente, función o hook**, se debe verificar que no exista ya uno equivalente en el proyecto (en `components/ui/`, `lib/`, `hooks/` o en otros módulos). Si existe algo similar, se reutiliza o se extiende en vez de duplicar.

---

## 3. Metodología de trabajo

### SDD (Spec Driven Development)

El desarrollo de features sigue **SDD**: primero se define la especificación, luego se implementa, y luego se revisa contra esa especificación. El flujo se apoya en 4 agentes:

- **Orquestador**: coordina el flujo de trabajo entre los demás agentes y decide el siguiente paso.
- **Spec**: define la especificación de la feature (requerimientos, criterios de aceptación) antes de escribir código.
- **Developer**: implementa la feature siguiendo la especificación y las reglas de este documento.
- **Reviewer**: revisa la implementación contra la especificación y las buenas prácticas definidas en la sección 2.

### Unit testing

Se usa **Vitest + React Testing Library** para las secciones del proyecto que lo requieran (lógica de negocio, hooks, servicios y componentes con comportamiento relevante). Los tests se colocan junto al archivo que prueban, siguiendo el naming definido en la sección 1.
