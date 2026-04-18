# cdkactions

[![Release](https://github.com/FactbirdHQ/cdkactions/workflows/Release/badge.svg)](https://github.com/FactbirdHQ/cdkactions/actions/workflows/release.yaml)
[![NPM](https://badge.fury.io/js/@factbird%2Fcdkactions.svg)](https://www.npmjs.com/package/@factbird/cdkactions)

A type-safe [CDK](https://aws.amazon.com/cdk/) for GitHub Actions. Define workflows as a tree of [constructs](https://github.com/aws/constructs) in TypeScript with compile-time guarantees — invalid runner labels, unknown action inputs, and misconfigured permissions are caught before synthesis, not after a failed CI run.

## Why cdkactions

GitHub Actions workflows are YAML files with no type checking, no IDE support beyond schema validation, and no composability beyond composite actions. cdkactions solves this by letting you define workflows in TypeScript where the compiler enforces correctness:

- **Branded nominal types** prevent passing a bare string where a `RunnerLabel`, `Shell`, or `TokenPermission` is expected
- **Typed expressions** (`Expression<T>`) give you autocomplete on `github.ref`, `runner.os`, and all 11 context objects — with compile-time errors for typos
- **`ActionRef<TInputs, TOutputs>`** makes third-party action usage type-safe: required inputs are enforced, unknown inputs are rejected, and `.output()` only accepts declared output keys
- **Construct-based composition** lets you publish reusable stacks, workflows, and jobs as npm packages — not fragile YAML templates

## Quick Start

```bash
npm install @factbird/cdkactions constructs
```

```typescript
import { App, Stack, Workflow, Job, RunnerLabel } from '@factbird/cdkactions';

const app = new App();
const stack = new Stack(app, 'ci');

const workflow = new Workflow(stack, 'build', {
  name: 'CI',
  on: {
    push: { branches: ['main'] },
    pullRequest: { branches: ['main'] },
  },
});

new Job(workflow, 'test', {
  runsOn: RunnerLabel.UBUNTU_LATEST,
  steps: [
    { uses: 'actions/checkout@v4' },
    { name: 'Install', run: 'npm ci' },
    { name: 'Test', run: 'npm test' },
  ],
});

app.synth();
```

Run `npx ts-node main.ts` (or `bun run main.ts`) to produce `.github/workflows/cdkactions_build.yaml`.

## Features

| Feature | Description | Example |
|---------|-------------|---------|
| Matrix builds | Generic `StrategyProps<TMatrix>` with typed `matrix.<key>` access | [01-nodejs-ci-matrix.ts](packages/cdkactions/examples/01-nodejs-ci-matrix.ts) |
| Docker services | Container jobs with `command` and `entrypoint` | [07-container-services.ts](packages/cdkactions/examples/07-container-services.ts) |
| Composite actions | Reusable multi-step actions as constructs | [08-composite-action.ts](packages/cdkactions/examples/08-composite-action.ts) |
| Typed expressions | `github.*`, `runner.*`, comparison operators, built-in functions | [09-expressions-conditions.ts](packages/cdkactions/examples/09-expressions-conditions.ts) |
| Full permissions | All 16 scopes with restricted subtypes (`idToken: 'write'\|'none'`) | [11-permissions-concurrency.ts](packages/cdkactions/examples/11-permissions-concurrency.ts) |
| Runner groups | `RunnerGroupConfig`, custom labels, runner registry pattern | [12-multi-platform-runner-groups.ts](packages/cdkactions/examples/12-multi-platform-runner-groups.ts) |
| Typed action refs | `ActionRef<TInputs, TOutputs>` with compile-time input/output checks | [16-typed-action-refs.ts](packages/cdkactions/examples/16-typed-action-refs.ts) |
| Validation | Synth-time checks: step mutual exclusion, cron syntax, matrix size | Built-in via `Node.addValidation()` |

See all 17 examples in [`packages/cdkactions/examples/`](packages/cdkactions/examples/).

## Migration from Previous Version

### Runner labels

```typescript
// Before
new Job(workflow, 'build', {
  runsOn: 'ubuntu-latest',           // bare string — any typo accepted
  // ...
});

// After
new Job(workflow, 'build', {
  runsOn: RunnerLabel.UBUNTU_LATEST,  // branded type — typos are compile errors
  // ...
});
```

### Steps

```typescript
// Before — run and uses on the same interface, no mutual exclusion
const step: StepsProps = {
  uses: 'actions/checkout@v4',
  run: 'echo hi',  // no error, but invalid at runtime
};

// After — discriminated union prevents invalid combinations
const step: RunStep = { run: 'echo hi' };
const step: UsesStep = { uses: 'actions/checkout@v4' };
// { run: '...', uses: '...' } is a compile error
```

### Permissions

```typescript
// Before — only contents scope
{ permissions: { contents: 'write' } }

// After — all 16 scopes, restricted subtypes
{
  permissions: {
    contents: 'write',
    packages: 'read',
    idToken: 'write',   // only 'write' | 'none' accepted
    models: 'read',     // only 'read' | 'none' accepted
  }
}
```

### Strategy

```typescript
// Before
{ strategy: { matrix: { os: ['ubuntu-latest'] }, fastFail: true } }

// After — generic TMatrix, typed include/exclude, renamed to match GitHub
{ strategy: { matrix: { os: ['ubuntu-latest'] as const }, failFast: true } }
```

## Contributing

```bash
git clone https://github.com/FactbirdHQ/cdkactions.git
cd cdkactions

# Enter the dev shell (provides Node.js + corepack)
nix develop --no-pure-eval
# or with direnv: direnv allow

# Install and build
corepack yarn install --immutable
corepack yarn build

# Run tests
bun test
```

## License

This project is distributed under the [Apache License, Version 2.0](./LICENSE).
