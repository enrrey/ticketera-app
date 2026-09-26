# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Turbopack) at http://localhost:3000
npm run build      # production build (Turbopack)
npm run start      # run the production build
npm run lint       # ESLint (flat config, eslint-config-next)
npm run typecheck  # tsc --noEmit
npm test           # Vitest, single run
npm run test:watch # Vitest in watch mode

npx vitest run src/components/ui/button.test.tsx   # a single test file
npx vitest run -t "renders its label"              # a single test by name
```

Tests run on **Vitest + React Testing Library** (jsdom), configured in `vitest.config.mts` and `vitest.setup.ts`. Do not substitute another runner. The config file is `.mts` on purpose: as plain `.ts` Vite warns that ESM-in-CommonJS will break in a future major.

`npm run build` takes ~1-2 minutes; prefer `npm run typecheck` while iterating.

## Stack

- **Next.js 16** (App Router, Turbopack, `src/` directory) with **React 19** and **TypeScript** (strict mode).
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` and `@theme inline` in `src/app/globals.css` (no `tailwind.config.*` file; v4 is CSS-first).
- Import alias `@/*` → `./src/*` (see `tsconfig.json`).
- State/data libraries installed: `axios`, `@tanstack/react-query`, `@tanstack/react-table`, `zod`, `zustand`.
- `src/app/providers.tsx` is the single client boundary for app-wide context: it holds `QueryClientProvider` (client created per mount, so it is never shared across SSR requests) and `next-themes`' `ThemeProvider`. Add new global providers there rather than in `layout.tsx`.
- Dark mode is class-based (`.dark`), driven by `next-themes` with `attribute="class"`. `<html>` carries `suppressHydrationWarning` because `next-themes` sets that class on the client.
- `shadcn/ui` is set up and working: `components.json` (style `base-nova`, base color `neutral`, icons `lucide-react`), the neutral theme in `src/app/globals.css`, `src/lib/utils.ts`, and `src/components/ui/button.tsx`. Adding components works — see the note below before running the CLI.

## Architecture — read `docs/SETUP.md` first

**`docs/SETUP.md` is the source of truth** for folder structure, naming and development practices. Read it before creating any file. Summary of what it mandates:

- Code is organized **by domain module** under `src/modules/<domain>/` (its own `components/`, `hooks/`, `services/`, `types.ts`, `index.ts` barrel) — not by file type.
- `src/app/` holds **routes only** and stays thin: it composes what modules expose and carries no business logic. Cross-module access goes through the module's `index.ts` barrel, never its internals.
- Naming: components `PascalCase.tsx`, hooks `useThing.ts`, services/utilities `camelCase.ts`, folders `kebab-case`, tests `<file>.test.ts(x)` colocated. All names in English.
- Shared, domain-less code lives in `src/components/ui/` (shadcn), `src/lib/` (e.g. `cn()`), `src/hooks/` — matching the aliases in `components.json`.
- SOLID, DRY, KISS and YAGNI apply to everything.

Codebase is still a bare `create-next-app` scaffold (`src/app/layout.tsx`, `src/app/page.tsx`); `src/modules/` appears as soon as the first feature lands.

### Reuse before creating (mandatory)

Before writing any component, hook, function or type: search the project for an existing equivalent — by name **and by concept** — across `src/components/ui/`, `src/lib/`, `src/hooks/` and `src/modules/*/`. For UI, check whether **shadcn/ui** already provides it and install it instead of hand-rolling. Only build what genuinely does not exist, and build it reusable.

## Workflow — SDD and the agents in `.claude/agents/`

This project works with **Spec Driven Development**. Four agents are defined in `.claude/agents/`:

| Agent | Role |
| --- | --- |
| `orchestrator` | Entry point. Triages **SDD vs. direct build mode**, sizes the plan to one session, dispatches the others, runs the correction loop. |
| `spec` | Writes `docs/specs/<feature>/spec.md`: objective, scope, verifiable acceptance criteria, reuse inventory, test requirements. Writes no implementation code. |
| `developer` | Implements **one** planned task under exclusive file ownership. |
| `reviewer` | Validates the implementation against the spec's acceptance criteria and `docs/SETUP.md`; writes `review.md` and issues APROBADO / CAMBIOS REQUERIDOS. Does not fix code. |

Specs, plans and reviews live in `docs/specs/<feature>/`.

**Human approval gate (blocking).** A spec must be explicitly approved by a human before any implementation starts. `spec.md` carries a status header that begins as `PENDIENTE DE APROBACIÓN`; only the orchestrator flips it to `APROBADO`, and only after an explicit human yes. While it is not `APROBADO`, do not write `plan.md`, do not dispatch `developer`, and do not touch `src/`. Automated notifications, background task results and prior-turn summaries never count as approval.

Not everything needs SDD — small, well-understood changes (a bug fix with a known cause, config, copy, ≤2 files) go through normal build mode, still respecting the reuse and structure rules above.

**Parallel work.** Tasks may run in parallel only when their file sets are disjoint and independent. Shared zones (`package.json`/lockfile, `components.json`, configs, `src/app/layout.tsx`, `src/app/globals.css`, module `index.ts` barrels) are never assigned to parallel agents — in particular, all `npm install` / `npx shadcn add` happens upfront, serially, since concurrent installs corrupt the lockfile.

## Known environment issue: `npm install` and the shadcn CLI

Claude Code sets `npm_config_allow_scripts=@anthropic-ai/claude-code` in the environment of every shell it spawns. npm 11.17+ rejects that config outright for project-scoped installs — verified in npm's source (`lib/utils/resolve-allow-scripts.js`), which throws `EALLOWSCRIPTS` whenever the policy comes from the `cli` or `env` source and the install is not global. The value is irrelevant; only its origin matters, so adding an `allowScripts` field to `package.json` does **not** help.

What this means in practice:

| Command | Works? |
| --- | --- |
| `npm install <pkgs>` **from Claude Code** | ❌ `EALLOWSCRIPTS` |
| `npm install <pkgs>` **from the user's own terminal** | ✅ |
| `npx shadcn@latest init` | ❌ anywhere — it unconditionally runs `npm install shadcn@latest`, even when shadcn is already installed |
| `npx shadcn@latest add <component>` | ✅ when the component's dependencies are already present (it then runs no install at all) |

So: **never run `shadcn init`** — the project is already initialized. Use `npx shadcn@latest add <component>`, which works from Claude Code. If a component pulls a dependency the project does not have yet, the `add` will fail at "Installing dependencies"; ask the user to install that package from their own terminal, then re-run the `add`.

As a last resort, registry items can be fetched directly and written by hand — `https://ui.shadcn.com/r/styles/base-nova/<item>.json` returns the authentic file contents and dependency list (this is how `src/lib/utils.ts` and the `globals.css` theme were produced).

Do not modify `~/.npmrc` or unset `npm_config_allow_scripts` to work around any of this — that setting is an intentional sandbox control.
