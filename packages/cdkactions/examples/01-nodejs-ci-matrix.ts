import { App, Stack, Workflow, Job, RunnerLabel, createMatrixProxy } from '#src/index.ts';
import { checkoutV4, setupNodeV6 } from '#src/actions.ts';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'ci');

  const workflow = new Workflow(stack, 'node-ci', {
    name: 'Node.js CI',
    on: {
      push: { branches: ['main'], paths: ['src/**', 'package.json'] },
      pullRequest: { branches: ['main'] },
    },
  });

  const matrixDef = { nodeVersion: ['18', '20', '22'] } as const;
  const m = createMatrixProxy(matrixDef);

  new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: matrixDef,
      failFast: false,
    },
    steps: [
      checkoutV4(),
      setupNodeV6({ id: 'setup-node', with: { nodeVersion: `${m.nodeVersion}` } }),
      { name: 'Install', run: 'npm ci' },
      { name: 'Lint', run: 'npm run lint' },
      { name: 'Test', run: 'npm test' },
    ],
  });

  return _app;
}
