import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(_app, 'stale');

  const workflow = new Workflow(stack, 'stale', {
    name: 'Close Stale Issues',
    on: {
      schedule: [
        { cron: '0 0 * * *', timezone: 'America/New_York' },
        { cron: '0 12 * * *', timezone: 'America/New_York' },
      ],
    },
  });

  new Job(workflow, 'stale', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    permissions: { issues: 'write', pullRequests: 'write' },
    steps: [
      {
        uses: 'actions/stale@v9',
        with: {
          'days-before-stale': 60,
          'days-before-close': 7,
          'stale-issue-message': 'This issue is stale.',
        },
      },
    ],
  });

  return _app;
}
