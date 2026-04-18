import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(_app, 'secure');

  const workflow = new Workflow(stack, 'secure', {
    name: 'Security Scan',
    on: { push: { branches: ['main'] } },
    permissions: {
      actions: 'read',
      contents: 'read',
      securityEvents: 'write',
      idToken: 'write',
      models: 'read',
    },
    concurrency: {
      group: 'security-${{ github.ref }}',
      cancelInProgress: false,
    },
  });

  new Job(workflow, 'scan', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    concurrency: 'scan-serial',
    permissions: {
      securityEvents: 'write',
      contents: 'read',
    },
    steps: [
      { uses: 'actions/checkout@v4' },
      { uses: 'github/codeql-action/init@v3' },
      { uses: 'github/codeql-action/analyze@v3' },
    ],
  });

  return _app;
}
