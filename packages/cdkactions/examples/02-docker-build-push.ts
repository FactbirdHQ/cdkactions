import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(_app, 'docker');

  const workflow = new Workflow(stack, 'docker', {
    name: 'Docker Publish',
    on: {
      push: { branches: ['main'], tags: ['v*'] },
    },
    permissions: {
      contents: 'read',
      packages: 'write',
    },
    concurrency: {
      group: 'docker-${{ github.ref }}',
      cancelInProgress: true,
    },
  });

  new Job(workflow, 'push', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    environment: { name: 'production', url: 'https://ghcr.io' },
    permissions: {
      contents: 'read',
      packages: 'write',
      attestations: 'write',
      idToken: 'write',
    },
    steps: [
      { uses: 'actions/checkout@v4' },
      {
        name: 'Login to GHCR',
        uses: 'docker/login-action@v3',
        with: {
          registry: 'ghcr.io',
          username: '${{ github.actor }}',
          password: '${{ secrets.GITHUB_TOKEN }}',
        },
      },
      {
        name: 'Build and push',
        uses: 'docker/build-push-action@v5',
        with: { push: true, tags: 'ghcr.io/${{ github.repository }}:latest' },
      },
    ],
  });

  return _app;
}
