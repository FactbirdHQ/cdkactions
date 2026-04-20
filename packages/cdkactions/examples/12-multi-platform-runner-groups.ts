import { App, Stack, Workflow, Job, RunnerLabel, createMatrixProxy } from '#src/index.ts';
import { checkoutV4 } from '#src/actions.ts';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'multi-platform');

  const workflow = new Workflow(stack, 'build', {
    name: 'Multi-Platform Build',
    on: { push: { branches: ['main'] } },
  });

  const matrixDef = {
    os: ['ubuntu-latest', 'macos-latest', 'windows-latest'],
    arch: ['x64', 'arm64'],
  } as const;
  const m = createMatrixProxy(matrixDef);

  new Job(workflow, 'build', {
    runsOn: { group: 'large-runners', labels: [RunnerLabel.custom('linux-x64-8core')] },
    strategy: {
      matrix: matrixDef,
      failFast: false,
      maxParallel: 4,
    },
    continueOnError: true,
    timeoutMinutes: 60,
    steps: [checkoutV4(), { name: 'Build', run: `make build ARCH=${m.arch}` }],
  });

  return _app;
}
