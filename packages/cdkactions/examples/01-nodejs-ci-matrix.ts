import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
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
      { uses: 'actions/checkout@v4' },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v4',
        with: { 'node-version': '${{ matrix.node-version }}' },
      },
      { name: 'Install', run: 'npm ci' },
      { name: 'Lint', run: 'npm run lint' },
      { name: 'Test', run: 'npm test' },
    ],
  });

  return _app;
}
