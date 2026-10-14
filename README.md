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

A tag such as `@v7` can be moved by whoever controls the action's repository. `.pinned(sha)` and `.pinned(sha, version)` return the same typed action at an exact commit, so its steps emit `uses: <action>@<sha>` and keep their typed inputs and outputs. `sha` must be the full 40-character lowercase hex commit, or `pinned()` throws. `version` is optional, names a tag, and never reaches the YAML; `cdkactions sync-action-pins` rewrites it together with the SHA.

`App.synth()` checks every pin that carries a version: it reads the action repository's tags with `git ls-remote --tags https://github.com/<owner>/<repo>`, peeling annotated tags through `^{}`, and fails unless the tag points at the pinned SHA. The error names the action, the SHA, the version and where the tag points now; a failure on a pin nobody changed means the tag moved after review. Each repository is read once per synth, the rest in parallel after the first answers. A pin without a version is not checked.

- When GitHub cannot be reached, a local synth prints one warning naming the unverified pins and goes on.
- Under GitHub Actions (`GITHUB_ACTIONS=true`), an unreachable GitHub fails the synth. CI never skips the check, and a runner that cannot reach GitHub is broken anyway.
- A read that fails after GitHub answered fails the synth everywhere, so a flaky network cannot leave the check half done.

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

- `'<action>@<old>'`, the plain string, rewriting a trailing `// <version>` comment on that line when there is one,
- `.pinned('<old>', '<version>')` or `.pinned('<old>')`, the typed form, rewriting the SHA and any version.

The version is the most specific semver tag that `git ls-remote --tags https://github.com/<owner>/<repo>` shows at the new commit (`v7.0.1` over `v7`). When no tag matches, the version stays as it was and the output says so. The command exits non-zero, writing nothing, when a new ref is not a 40-character commit SHA or when no source pins an old commit, since the sources and the workflows had then already drifted. A bump the sources already carry is reported and skipped.

`DependabotActionPinSync` emits the workflow that runs it on Dependabot's pull requests:

```typescript
import { DependabotActionPinSync, setupBunV2 } from '@factbird/cdkactions';

new DependabotActionPinSync(stack, 'dependabot-action-pins', {
  sources: ['cicd/**/*.ts'],
  setupSteps: [
    setupBunV2.pinned('0c5077e51419868618aeaa5fe8019c62421857d6', 'v2.2.0')({ id: 'bun' }),
    { name: 'Install', run: 'bun install --frozen-lockfile' },
  ],
  synthCommand: 'bun run synth:workflows',
});
```

| Prop | Default | |
|------|---------|-|
| `sources` | | Files or globs that pin actions |
| `synthCommand` | | Regenerates the workflows |
| `setupSteps` | `[]` | Installs what the CLI and the synth need |
| `cliCommand` | `npx --no cdkactions` | Needs `@factbird/cdkactions-cli` installed by `setupSteps` |
| `workflowsDir` | `.github/workflows` | |
| `appIdSecret`, `appPrivateKeySecret` | `APP_ID`, `APP_PEM` | The GitHub App that pushes the source change |
| `repositories` | the current repository | Repositories the app token covers |
| `runsOn` | `ubuntu-latest` | |

The workflow has two jobs, and both run only when Dependabot opened the pull request, triggered the run, and pushed the head to this repository:

- `regenerate` checks out the head commit without persisted credentials, with a read-only token and no secrets, runs the setup steps, the command and the synth, fails unless the synthesized workflows match Dependabot's byte for byte, and uploads the changed source files.
- `push` checks nothing out and runs none of the pull request's code. It mints the app token, checks each file against `sources`, and writes it to the head branch through the contents API, failing if the branch moved past the commit `regenerate` read.

Dependabot reads the app secrets from the repository's or organization's Dependabot secrets. The app's commit runs CI again, and Dependabot stops rebasing a pull request someone else pushed to, so `@dependabot recreate` is how to rebuild one.

### Verifying pins against their tags

`cdkactions verify-action-pins <source files or globs...>` finds the same two pin forms and runs the check `App.synth()` runs, through the same library code: for every pin to a commit that carries a version, `git ls-remote --tags` must show that tag, peeled through `^{}` for an annotated tag, at the pinned commit. Pins without a version are listed as unversioned and not checked.

It exits non-zero listing every failing pin with its file and line, the action, the commit, the version and where the tag points now. Unlike a local synth, it also fails when GitHub cannot be reached, since checking is its whole job. A tag can move, so a pass holds only when the command runs; a failure on a pin nobody changed means the tag moved after the pin was reviewed.

A typed pin resolves its action through the helper's name: the library's own, such as `checkoutV7`, or a `const <name> = defineAction(...)` in the scanned sources. A versioned pin through any other name fails as unknown.

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
