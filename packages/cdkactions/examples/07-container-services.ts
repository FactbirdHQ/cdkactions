import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(_app, 'integration');

  const workflow = new Workflow(stack, 'integration', {
    name: 'Integration Tests',
    on: { push: { branches: ['main'] } },
  });

  new Job(workflow, 'integration', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    container: {
      image: 'node:20-bookworm',
      env: { NODE_ENV: 'test' },
      volumes: ['/tmp/cache:/cache'],
      options: '--cpus 2',
    },
    services: {
      postgres: {
        image: 'postgres:16',
        env: {
          POSTGRES_USER: 'test',
          POSTGRES_PASSWORD: 'test',
          POSTGRES_DB: 'testdb',
        },
        ports: ['5432:5432'],
        options: '--health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5',
      },
      redis: {
        image: 'redis:7',
        ports: ['6379:6379'],
        command: 'redis-server --requirepass testpass',
        entrypoint: '',
      },
    },
    steps: [
      { uses: 'actions/checkout@v4' },
      { name: 'Run integration tests', run: 'npm run test:integration' },
    ],
  });

  return _app;
}
