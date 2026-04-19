# Getting Started (TypeScript)

## Install

```bash
npm install @factbird/cdkactions constructs
```

## Create a workflow

Create a file (e.g., `main.ts`) that defines your GitHub Actions workflows:

```typescript
import {
  App, Stack, Workflow, Job, RunnerLabel,
  checkoutV4, expression, eq, not, and,
} from '@factbird/cdkactions';

const { github, secrets } = expression;

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

## Typed expressions

Context proxies provide autocomplete on all GitHub Actions contexts. Expressions are automatically wrapped in `${{ }}` during synthesis.

```typescript
const { github, secrets, env, matrix } = expression;

// Use directly in step config — auto-wrapped during synthesis
{
  with: {
    username: github.actor,        // → ${{ github.actor }}
    password: secrets.GITHUB_TOKEN, // → ${{ secrets.GITHUB_TOKEN }}
  },
}

// Compose with operators
const isMain = eq(github.ref, 'refs/heads/main');
const deployCondition = and(isMain, not(eq(github.actor, 'dependabot[bot]')));

// Use in `if` — raw expression without ${{ }} (GitHub auto-evaluates)
new Job(workflow, 'deploy', {
  if: deployCondition,
  // ...
});

// Template literals — tokens are resolved during synthesis
{ concurrency: { group: `deploy-${github.ref}` } }
// → "deploy-${{ github.ref }}"
```

## Typed action references

Pre-defined actions like `checkoutV4`, `uploadArtifactV4`, and `setupNodeV6` enforce inputs and outputs at compile time.

```typescript
import { checkoutV4, uploadArtifactV4 } from '@factbird/cdkactions';

// All-optional inputs — parameter is optional
checkoutV4()
checkoutV4({ with: { fetchDepth: 0, lfs: true } })

// Required inputs are enforced
uploadArtifactV4({ id: 'upload', with: { name: 'dist', path: 'dist/' } })

// Typed output access
const co = checkoutV4({ id: 'co' });
co.output('commit');  // ✓
// co.output('foo');  // ✗ compile error
```

Define your own typed actions:

```typescript
import { defineAction } from '@factbird/cdkactions';

const myAction = defineAction<
  { environment: { required: true }; dryRun: { default: 'false' } },
  { deployUrl: {} }
>('my-org/deploy-action@v1');

myAction({ id: 'deploy', with: { environment: 'prod' } });
```

## Tips & Tricks

When defining a multiline run command for a step, [ts-dedent](https://www.npmjs.com/package/ts-dedent) strips extra indentation from template literals:

```typescript
import dedent from 'ts-dedent';

{ run: dedent`
  echo "Step 1"
  echo "Step 2"
` }
```

## Synthesize manifests

After making changes, regenerate the YAML files:

```bash
bun run main.ts
```

## API Reference

See the [API reference](../../packages/cdkactions/API.md) for all constructs and properties, and the [examples](../../packages/cdkactions/examples/) for complete usage patterns.
