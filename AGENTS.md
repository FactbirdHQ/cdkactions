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

### Typed Action References (`ActionRef`)

External GitHub Actions are defined centrally with full input/output type safety using `ActionRef.fromReference<TInputs, TOutputs>(ref)`. The generic type parameters capture the action's input schema (required vs optional, defaults) and output schema.

Invocation via `.call(options)` returns a `TypedUsesStep<TOutputs>` — a subtype of `UsesStep` with a typed `.output(key)` accessor. This slots seamlessly into the `StepConfig` union.

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

Context accessors (e.g., `github`, `runner`) use `Proxy` objects created once at module load to generate `${{ context.prop }}` strings on property access.

### Condition Class

Uses `ts-pattern` for exhaustive matching on the `ConditionExpression` discriminated union (`string | { or: [...] } | { and: [...] }`). Composable via `.and()` / `.or()` methods.

## Synthesis

1. `App.synth()` iterates over Stack children
2. `Stack.synthesize(outdir)` iterates over Workflow children, calling `toGHAction()` on each
3. `Workflow.toGHAction()` collects Job children and calls `toGHAction()` on each
4. YAML output via `js-yaml.dump()` with options: `{ lineWidth: -1, noCompatMode: true, quotingType: '"' }`
5. Output files: `cdkactions_<sanitized-id>.yaml` with a header comment
6. CompositeActions output to `.github/actions/<dir>/action.yml`

### Performance

Synthesis must be fast (< 100ms for 200 jobs). Key constraints:
- No AST for expressions — branded strings only
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
- `ts-pattern` ^5.7.0 — exhaustive pattern matching (used in Condition class)
- TypeScript 5.8+, Node 20+

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

- ESM modules (`.js` extensions in imports)
- Single `index.ts` barrel export — all public API exported from here
- No default exports
- Source in `src/`, tests in `test/`, examples in `examples/`
