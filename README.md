# cdkactions

[![Release](https://github.com/FactbirdHQ/cdkactions/workflows/Release/badge.svg)](https://github.com/FactbirdHQ/cdkactions/actions/workflows/release.yaml)
[![NPM](https://badge.fury.io/js/@factbird%2Fcdkactions.svg)](https://www.npmjs.com/package/@factbird/cdkactions)

A type-safe [CDK](https://aws.amazon.com/cdk/) for GitHub Actions. Define workflows as a tree of [constructs](https://github.com/aws/constructs) in TypeScript with compile-time guarantees — invalid runner labels, unknown action inputs, and misconfigured permissions are caught before synthesis, not after a failed CI run.

## Why cdkactions

GitHub Actions workflows are YAML files with no type checking, no IDE support beyond schema validation, and no composability beyond composite actions. cdkactions solves this by letting you define workflows in TypeScript where the compiler enforces correctness:

- **Branded nominal types** prevent passing a bare string where a `RunnerLabel`, `Shell`, or `TokenPermission` is expected
- **Typed expressions** (`Expression<T>`) give you autocomplete on `github.ref`, `runner.os`, and all 11 context objects — with compile-time errors for typos
- **`Action<TInputs, TOutputs>`** makes third-party action usage type-safe: call directly (`checkoutV4()` or `checkoutV4({ with: { fetchDepth: 0 } })`), and the compiler enforces required inputs, rejects unknown keys, and restricts `.output()` to declared output keys
- **Construct-based composition** lets you publish reusable stacks, workflows, and jobs as npm packages — not fragile YAML templates

## Quick Start

```bash
npm install @factbird/cdkactions constructs
```

```typescript
import { App, Stack, Workflow, Job, RunnerLabel, checkoutV4 } from '@factbird/cdkactions';

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
    checkoutV4(),
    { name: 'Install', run: 'npm ci' },
    { name: 'Test', run: 'npm test' },
  ],
});

app.synth();
```

Run `npx ts-node main.ts` (or `bun run main.ts`) to produce `.github/workflows/cdkactions_build.yaml`.

## Typed Expressions

Context proxies give you autocomplete on all GitHub Actions contexts. Expressions are automatically wrapped in `${{ }}` during synthesis — no manual wrapping needed.

```typescript
import { expression, eq, not, and } from '@factbird/cdkactions';

const { github, secrets, env } = expression;

// Context proxies — autocomplete on github.ref, github.actor, etc.
github.ref           // Expression<string>
secrets.GITHUB_TOKEN // Expression<string>

// Compose with operators — returns Expression<boolean>
const isMain = eq(github.ref, 'refs/heads/main');
const deployCondition = and(isMain, not(eq(github.actor, 'dependabot[bot]')));

// Use anywhere — auto-wrapped during synthesis
new Job(workflow, 'push', {
  runsOn: RunnerLabel.UBUNTU_LATEST,
  if: deployCondition,
  steps: [{
    name: 'Login',
    uses: 'docker/login-action@v3',
    with: {
      username: github.actor,        // → ${{ github.actor }}
      password: secrets.GITHUB_TOKEN, // → ${{ secrets.GITHUB_TOKEN }}
    },
  }],
});

// Template literals work too
{ concurrency: { group: `deploy-${github.ref}` } }
// → "deploy-${{ github.ref }}"
```

## Typed Action References

Pre-defined actions enforce required inputs, reject unknown keys, and give typed `.outputs` proxy access — all at compile time.

```typescript
import { checkoutV4, uploadArtifactV4, setupNodeV6 } from '@factbird/cdkactions';

// Callable — all-optional inputs means the parameter is optional
const co = checkoutV4({ id: 'co', with: { fetchDepth: 0 } });
co.outputs.commit; // ✓ declared output
// co.outputs.digest; // ✗ compile error — not a declared output

// Required inputs are enforced
const upload = uploadArtifactV4({
  id: 'upload',
  with: { name: 'dist', path: 'dist/' }, // name and path are required
});

new Job(workflow, 'build', {
  runsOn: RunnerLabel.UBUNTU_LATEST,
  outputs: { artifact_id: `${upload.outputs.artifactId}` },
  steps: [co, setupNodeV6({ id: 'node', with: { nodeVersion: '22' } }), upload],
});
```

Define your own typed actions with `defineAction`:

```typescript
import { defineAction } from '@factbird/cdkactions';

const myAction = defineAction<
  { environment: { required: true }; dryRun: { default: 'false' } },
  { deployUrl: {} }
>('my-org/deploy-action@v1');
```

An input whose `action.yml` name is not kebab-case, such as `cachix/cachix-action`'s `authToken`, goes in `verbatimInputs` so its key reaches the YAML as written:

```typescript
const cachixActionV16 = defineAction<{ name: { required: true }; authToken: { default: string } }>(
  'cachix/cachix-action@v16',
  { verbatimInputs: ['authToken'] },
);
```

### Pinning an action to a commit

A tag such as `@v7` can be moved by whoever controls the action's repository. `.pinned(sha, version)` returns the same typed action at an exact commit, so its steps emit `uses: <action>@<sha>` and keep their typed inputs and outputs. `sha` must be the full 40-character lowercase hex commit, or `pinned()` throws while the app synthesizes. `version` names the release tag at that commit; it never reaches the YAML, and `cdkactions sync-action-pins` rewrites it together with the SHA. When the definition's reference names a major, such as `@v7`, `version` must be in that major, so `checkoutV7.pinned(sha, 'v6.0.1')` throws.

```typescript
import { checkoutV7, createGithubAppTokenV3, secrets } from '@factbird/cdkactions';

const checkout = checkoutV7.pinned('3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1');
const appToken = createGithubAppTokenV3.pinned('64ab729a6294000f5aa4a4bc0b73d1f32bc45510', 'v3.3.0');

const token = appToken({ id: 'app-token', with: { clientId: secrets.APP_ID, privateKey: secrets.APP_PEM } });
const steps = [token, checkout({ id: 'checkout', with: { token: token.outputs.token, fetchDepth: 0 } })];
// uses: actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510
// uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
```

Keep each pin in one shared module so a bump touches one line.

### Carrying Dependabot's action bumps into the source

Dependabot's `github-actions` ecosystem edits the generated `cdkactions_*.yaml` and never the TypeScript, so the next synth reverts its bump. `cdkactions sync-action-pins` carries each bump back:

```bash
cdkactions sync-action-pins --base <pr-base-sha> [--workflows .github/workflows] <source files or globs...>
```

It reads `git diff <base> -- <workflows>` for `cdkactions_*` files, pairs each removed `uses: <action>@<old>` line with the added line for the same action (`<action>` may carry a subpath), and in the sources replaces both pinned forms:

- `'<action>@<old>', // <version>`, the plain string, rewriting the trailing version comment on that line,
- `.pinned('<old>', '<version>')`, the typed form, rewriting both arguments.

The version is the most specific semver tag that `git ls-remote --tags https://github.com/<owner>/<repo>` shows at the new commit (`v7.0.1` over `v7`). When no tag matches, the version stays as it was and the output says so. The command exits non-zero, writing nothing, when a new ref is not a 40-character commit SHA or when no source pins an old commit, since the sources and the workflows had then already drifted. A bump the sources already carry is reported and skipped.

### Verifying pins against their releases

`cdkactions verify-action-pins <source files or globs...>` finds the same two pin forms and checks every pin to a commit:

- the version's tag, read with `git ls-remote --tags` and peeled through `^{}` for an annotated tag, points at the pinned commit,
- a GitHub release has that tag's name, so the version names an exact release rather than a moving tag such as `v7`.

It exits non-zero listing every pin that fails, with the action, the commit, the version and where the tag points now. Release lookups use the GitHub REST API, authenticated when `GITHUB_TOKEN` or `GH_TOKEN` is set, and a rate limit fails with the time it resets. A tag can move, so a pass holds only when the command runs; a failure on a pin nobody changed means the tag moved after the pin was reviewed.

A typed pin resolves its action through the helper's name: the library's own, such as `checkoutV7`, or a `const <name> = defineAction(...)` in the scanned sources. A pin through any other name fails as unknown.

## Features

| Feature | Description | Example |
|---------|-------------|---------|
| Matrix builds | Generic `StrategyProps<TMatrix>` with typed `matrix.<key>` access | [01-nodejs-ci-matrix.ts](packages/cdkactions/examples/01-nodejs-ci-matrix.ts) |
| Docker build & push | Concurrency, permissions, context proxies for credentials | [02-docker-build-push.ts](packages/cdkactions/examples/02-docker-build-push.ts) |
| Multi-job pipelines | Job dependencies, typed artifact upload/download, conditional deploy | [03-multi-job-pipeline.ts](packages/cdkactions/examples/03-multi-job-pipeline.ts) |
| Manual dispatch | `workflowDispatch` with typed `workflow.inputs` proxy (choice, boolean, environment) | [05-manual-dispatch.ts](packages/cdkactions/examples/05-manual-dispatch.ts) |
| Reusable workflows | `workflowCall` with inputs, outputs, and secrets | [06-reusable-workflow.ts](packages/cdkactions/examples/06-reusable-workflow.ts) |
| Docker services | Container jobs with `command` and `entrypoint` | [07-container-services.ts](packages/cdkactions/examples/07-container-services.ts) |
| Composite actions | Reusable multi-step actions as constructs | [08-composite-action.ts](packages/cdkactions/examples/08-composite-action.ts) |
| Typed expressions | Context proxies (`github.*`, `secrets.*`), operators, auto-wrapping | [09-expressions-conditions.ts](packages/cdkactions/examples/09-expressions-conditions.ts) |
| Cross-workflow deps | Workflow-to-workflow dependencies via `workflow_run` | [10-cross-workflow-deps.ts](packages/cdkactions/examples/10-cross-workflow-deps.ts) |
| Full permissions | All 16 scopes with restricted subtypes (`idToken: 'write'\|'none'`) | [11-permissions-concurrency.ts](packages/cdkactions/examples/11-permissions-concurrency.ts) |
| Runner groups | `RunnerGroupConfig`, custom labels, runner registry pattern | [12-multi-platform-runner-groups.ts](packages/cdkactions/examples/12-multi-platform-runner-groups.ts) |
| Runner registry | Organization-specific runner labels with `RunnerLabel.custom()` | [15-runner-registry.ts](packages/cdkactions/examples/15-runner-registry.ts) |
| Typed action refs | `Action<TInputs, TOutputs>` with compile-time input/output checks | [16-typed-action-refs.ts](packages/cdkactions/examples/16-typed-action-refs.ts) |
| Validation | Synth-time checks: step mutual exclusion, cron syntax, matrix size | Built-in via `Node.addValidation()` |

See all 17 examples in [`packages/cdkactions/examples/`](packages/cdkactions/examples/).

## Contributing

```bash
git clone https://github.com/FactbirdHQ/cdkactions.git
cd cdkactions

# Enter the dev shell (provides Node.js + corepack)
nix develop --no-pure-eval
# or with direnv: direnv allow

# Install and build
bun install
bun run build

# Run tests
bun test
```

## License

This project is distributed under the [Apache License, Version 2.0](./LICENSE).
