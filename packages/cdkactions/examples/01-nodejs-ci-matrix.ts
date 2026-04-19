import { App, Stack, Workflow, Job, RunnerLabel, expression } from '#src/index.ts';
import { checkoutV4, setupNodeV6 } from '#src/actions.ts';

const { matrix } = expression;

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

  new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: {
        nodeVersion: ['18', '20', '22'] as const,
      },
      failFast: false,
    },
    steps: [
      checkoutV4(),
      setupNodeV6({ id: 'setup-node', with: { nodeVersion: `${matrix.nodeVersion}` } }),
      { name: 'Install', run: 'npm ci' },
      { name: 'Lint', run: 'npm run lint' },
      { name: 'Test', run: 'npm test' },
    ],
  });

  return _app;
}
