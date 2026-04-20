import { App, Stack, Workflow, Job, RunnerLabel, Shell, CompositeAction, hashFiles, step } from '#src/index.ts';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'composite');

  const cacheStep = step({
    id: 'cache',
    uses: 'actions/cache@v4',
    with: { path: 'node_modules', key: `deps-${hashFiles('package-lock.json')}` },
  } as const);

  const setupAction = new CompositeAction('setup-project', {
    name: 'Setup Project',
    description: 'Install dependencies and build',
    inputs: {
      nodeVersion: { description: 'Node.js version', required: true },
      registry: { description: 'npm registry URL', required: false, default: 'https://registry.npmjs.org' },
    },
    outputs: {
      cacheHit: { description: 'Whether cache was hit', value: cacheStep.output('cache-hit') },
    },
    steps: [
      cacheStep,
      { name: 'Install', run: 'npm ci', shell: Shell.BASH },
    ],
  } as const);

  const workflow = new Workflow(stack, 'ci', {
    name: 'CI',
    on: { push: { branches: ['main'] } },
  });

  const job = new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
  });

  const setupStep = setupAction.asStep(workflow, {
    id: 'setup',
    with: { nodeVersion: '20' },
  });

  // Verify typed output accessor works
  const _cacheHit: string = setupStep.output('cacheHit');

  return _app;
}
