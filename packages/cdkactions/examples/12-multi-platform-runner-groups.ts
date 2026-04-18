import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
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
    steps: [
      { uses: 'actions/checkout@v4' },
      { name: 'Build', run: 'make build ARCH=${{ matrix.arch }}' },
    ],
  });

  return _app;
}
