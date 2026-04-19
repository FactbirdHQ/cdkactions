import { App, Stack, Workflow, Job, RunnerLabel, expression } from '#src/index.ts';
import { checkoutV4 } from '../src/actions.js';

const { matrix } = expression;

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'multi-platform');

  const workflow = new Workflow(stack, 'build', {
    name: 'Multi-Platform Build',
    on: { push: { branches: ['main'] } },
  });

  new Job(workflow, 'build', {
    runsOn: { group: 'large-runners', labels: [RunnerLabel.custom('linux-x64-8core')] },
    strategy: {
      matrix: {
        os: ['ubuntu-latest', 'macos-latest', 'windows-latest'] as const,
        arch: ['x64', 'arm64'] as const,
      },
      failFast: false,
      maxParallel: 4,
    },
    continueOnError: true,
    timeoutMinutes: 60,
    steps: [checkoutV4(), { name: 'Build', run: `make build ARCH=${matrix.arch}` }],
  });

  return _app;
}
