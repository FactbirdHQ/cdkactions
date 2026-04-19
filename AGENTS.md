# AGENTS.md — cdkactions Coding Patterns & Conventions

This file documents the architectural patterns, coding conventions, and design decisions in the cdkactions codebase. AI agents and contributors should follow these patterns when modifying or extending the project.

## Project Structure

Monorepo with Yarn workspaces under `packages/`:
- `packages/cdkactions` — core library (constructs, types, synthesis)
- `packages/cdkactions-cli` — CLI tool (`init`, `synth` commands)

Published as `@factbird/cdkactions` and `@factbird/cdkactions-cli`.

## Construct Hierarchy

cdkactions follows the AWS CDK construct model using the `constructs` library (peer dependency, ^10.4.2):

```
App (root, scope=undefined)
 └── Stack (groups workflows, handles synthesis)
      └── Workflow (represents a .yaml workflow file)
           └── Job (represents a job within the workflow)
```

- **App** — top-level construct, calls `synth()` to produce output files
- **Stack** — unit of synthesis; each Stack writes its workflows to disk
- **Workflow** — maps 1:1 to a `.github/workflows/cdkactions_<id>.yaml` file
- **Job** — maps to a job entry within the workflow's `jobs:` block
- **CompositeAction** — standalone (not a Construct); registered with Stack via `asStep()`

### Key Pattern: `Stack.of(construct)`

Walk up the construct tree to find the enclosing Stack. Used by `CompositeAction.asStep()` to auto-register with the correct stack.

### Key Pattern: `addDependency`

- `Job.addDependency(job)` → adds to `needs` array
- `Workflow.addDependency(workflow)` → sets up `workflow_run` trigger

## TypeScript Conventions

### Property Naming

- All TypeScript-facing properties use **camelCase**: `runsOn`, `timeoutMinutes`, `failFast`, `pullRequest`, `branchesIgnore`
- Serialization to YAML converts to the GitHub Actions format via `renameKeys()`:
  - camelCase → snake_case for event names: `pullRequest` → `pull_request`
  - camelCase → kebab-case for properties: `runsOn` → `runs-on`, `timeoutMinutes` → `timeout-minutes`

### `renameKeys` and `camelToSnake`

Located in `src/utils.ts`. `renameKeys(obj, mapping)` recursively renames object keys using an explicit mapping. `camelToSnake(str)` converts camelCase to snake_case for event name strings.

When adding new properties that need renaming, add entries to the mapping object in the relevant `toGHAction()` method — do NOT rely on auto-conversion.

### Readonly Interfaces

All config interfaces (`WorkflowProps`, `JobProps`, `StepsProps`, etc.) use `readonly` on every property. This enforces immutability at the type level.

Internally, `Writable<T>` (from `utils.ts`) is used when mutation is needed (e.g., `addDependency` pushing to `needs`).

### No `as X` Type Assertions

`as X` casts are not permitted. They bypass the type checker and hide real type mismatches. Instead:

- **Assign to a typed variable** — let TypeScript verify the assignment:
  ```typescript
  // Bad
  const config = { runsOn: 'ubuntu-latest' } as JobProps;

  // Good
  const config: JobProps = { runsOn: 'ubuntu-latest' };
  ```
- **Apply copies / spreads** when converting between compatible types:
  ```typescript
  // Bad
  const partial = fullConfig as PartialConfig;

  // Good
  const partial: PartialConfig = { ...fullConfig };
  ```
- **Use call signatures** for type-safe narrowing where applicable:
  ```typescript
  // Bad
  const label = value as RunnerLabel;

  // Good — use a function with a call signature that validates/converts
  function toRunnerLabel(value: string): RunnerLabel { ... }
  const label = toRunnerLabel(value);
  ```

The only exception is inside branded/nominal type `custom()` escape hatches (see below), where `as` is the intentional boundary between untyped and typed worlds.

### Branded / Nominal Types

Use the pattern:
```typescript
declare const Brand: unique symbol;
export type NominalType = string & { readonly [Brand]: never };
```

With a companion const object providing known values and a `custom()` escape hatch:
```typescript
export const NominalType = {
  VALUE_A: 'value-a' as NominalType,
  VALUE_B: 'value-b' as NominalType,
  custom(value: string): NominalType { return value as NominalType; },
} as const;
```

### Runner Registry Pattern

Organizations define custom runner labels centrally in a shared module, re-exporting `RunnerLabel` constants alongside their own:

```typescript
export const Runners = {
  ...RunnerLabel,
  MY_RUNNER: RunnerLabel.custom('my-runner'),
} as const;
export type OrgRunner = (typeof Runners)[keyof typeof Runners];
```

This pattern allows strict enforcement of valid runner labels at the type level without modifying cdkactions itself. The `RunnerLabel` type is the base; user-defined runner types are subtypes.

### Typed Action References (`Action`)

External GitHub Actions are defined centrally with full input/output type safety using `defineAction<TInputs, TOutputs>(ref)`. The generic type parameters capture the action's input schema (required vs optional, defaults) and output schema. Pre-defined action references (e.g., `checkoutV2`, `checkoutV3`, `checkoutV4`) live in `src/actions.ts`.

Actions are **directly callable** — `checkoutV4()` or `checkoutV4({ with: { fetchDepth: 0 } })`. When all inputs are optional and there are no outputs, the parameter is optional. The return is a `TypedUsesStep<TOutputs>` — a subtype of `UsesStep` with a typed `.output(key)` accessor. This slots seamlessly into the `StepConfig` union. Each action also exposes `.ref` and `.uses` properties for the raw reference string.

Key design rules:
- Input keys use **camelCase** in TypeScript, serialized to **kebab-case** in YAML (e.g., `fetchDepth` → `fetch-depth`)
- Inputs with `{ required: true }` must be provided in `with`
- Inputs with `{ default: '...' }` are optional
- Inputs with neither (`{}`) are optional (no default, not required)
- When the action has outputs, `id` is required on the step (needed for `${{ steps.id.outputs.x }}`)
- `TypedUsesStep` extends `UsesStep`, so it's accepted anywhere `StepConfig` is

Organizations define all their action references in a shared module (e.g., `actions.ts`), enabling single-point version upgrades and IDE discoverability.

### Expression System

Expressions are branded strings (`Expression<T>`) with a phantom type parameter tracking the runtime value type. They are zero-cost at runtime — no AST, no parsing.

Context accessors (e.g., `github`, `runner`, `secrets`, `matrix`) use `Proxy` objects created once at module load to generate expression strings like `github.ref` on property access.

All expression functions and context proxies are available via the `expression` namespace:

```typescript
import { expression } from '@factbird/cdkactions';
const { and, or, eq, github, secrets } = expression;
```

Individual exports (`eq`, `and`, `github`, etc.) are also available for direct import.

Composition uses free functions: `and(a, b)`, `or(a, b)`, `eq(left, right)`, `not(expr)`, etc. These return `Expression<boolean>` values that compose without wrapping.

**Token-based resolution:** Expressions encode themselves with Unicode noncharacter delimiters (`\uFDD0` / `\uFDD1`), making them recognizable in any string context — including template literal interpolation. At synthesis time, `resolveTokens()` walks the serialized output and resolves tokens based on field context:

- `if` fields → strip delimiters, leave raw expression (GitHub Actions auto-evaluates)
- All other fields → replace tokens with `${{ expression }}`

This means expressions work transparently everywhere — no manual `${{ }}` wrapping needed:

```typescript
// Expressions in with/env are auto-wrapped during synthesis
{ with: { username: github.actor, password: secrets.GITHUB_TOKEN } }

// Expressions in string interpolation are also auto-resolved
{ group: `docker-${github.ref}` }  // → "docker-${{ github.ref }}"
```

## Synthesis

1. `App.synth()` iterates over Stack children
2. `Stack.synthesize(outdir)` iterates over Workflow children, calling `toGHAction()` on each
3. `Workflow.toGHAction()` collects Job children and calls `toGHAction()` on each
4. `resolveTokens()` walks the serialized output, resolving expression tokens based on field context
5. YAML output via `js-yaml.dump()` with options: `{ lineWidth: -1, noCompatMode: true, quotingType: '"', sortKeys: true }`
6. Output files: `cdkactions_<sanitized-id>.yaml` with a header comment
7. CompositeActions output to `.github/actions/<dir>/action.yml`

### Performance

Synthesis must be fast (< 100ms for 200 jobs). Key constraints:
- No AST for expressions — branded strings with token delimiters
- `resolveTokens` is a single recursive pass at synthesis time
- `renameKeys` called once per construct
- Single-pass YAML dump
- Proxy context objects created once at module load

## Testing

- Tests in `packages/cdkactions/test/` using the project's test framework
- `TestingApp()` and `TestingWorkflow()` helpers in `test/utils.ts` create constructs with temp directories
- Example files in `examples/` double as snapshot tests
- Type-level tests use `// @ts-expect-error` annotations

## Dependencies

- `constructs` ^10.4.2 — peer dependency, provides construct tree
- `js-yaml` ^4.0.0 — YAML serialization
- `ts-dedent` ^2.2.0 — template literal dedentation
- TypeScript 5.8+, Node 20+
- Package manager: **Bun** — use `bun install`, `bun run`, `bun test`, etc.
- **treefmt** — unified formatter orchestrator (configured in `devenv.nix`). Runs Biome (JS/TS/JSON/CSS), Alejandra (Nix), and yamlfmt (YAML). Run `treefmt` to format the entire project.

## Development Environment

The project uses [devenv](https://devenv.sh/) (backed by Nix) to manage the development shell. The devenv configuration (`devenv.nix`) provides Node.js 22 with corepack enabled.

To enter the dev shell, either:
- **direnv** — install [nix-direnv](https://github.com/nix-community/nix-direnv) and allow the `.envrc` (`direnv allow`). The shell activates automatically when you `cd` into the project.
- **`nix develop`** — run `nix develop --no-pure-eval` to start a shell manually.

## Comments

- Never add excessive code comments for trivial code steps when functionality is easily interpreted from the code.
- Prefer descriptive function names and logical variables in branch conditions over comments that can be inferred from the name.
- Remove comments that merely restate what the code does — comments should explain "why", not "what".
- Safety guards should be documented to explain the "why" not just the "what".
- Do not use section separator comments (e.g., `// ─── SectionName ───`). If logical sections are needed, split into separate files instead.

## File Conventions

- ESM modules with subpath imports — use `#@/` for source modules and `#$/` for test modules
- All imports require `.js` extension: `from '#@/job.js'`, `from '#$/utils.js'`
- `#@/*` resolves to `src/*` (TypeScript) and `dist/*` (Node runtime) via conditional imports in package.json
- `#$/*` resolves to `test/*` (no conditional, development-only)
- **Import path rules:**
  - `index.ts` (barrel) files must use relative paths: `from './file.js'`
  - All other (non-index) files must use subpath imports: `from '#@/file.js'` or `from '#$/file.js'`
- Single `index.ts` barrel export — all public API exported from here
- No default exports
- Source in `src/`, tests in `test/`, examples in `examples/`
