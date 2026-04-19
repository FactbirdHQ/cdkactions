import { App, Stack, Workflow, Job, RunnerLabel } from '#src/index.ts';
import { checkoutV4 } from '#src/actions.ts';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'pages');

  const workflow = new Workflow(stack, 'pages', {
    name: 'Deploy to Pages',
    on: { push: { branches: ['main'] } },
    permissions: {
      contents: 'read',
      pages: 'write',
      idToken: 'write',
    },
    concurrency: {
      group: 'pages',
      cancelInProgress: false,
    },
  });

  const build = new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      checkoutV4(),
      { name: 'Build', run: 'npm run build' },
      { uses: 'actions/upload-pages-artifact@v3', with: { path: './dist' } },
    ],
  });

  const deploy = new Job(workflow, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    environment: { name: 'github-pages', url: '${{ steps.deployment.outputs.page_url }}' },
    steps: [{ id: 'deployment', uses: 'actions/deploy-pages@v4' }],
  });
  deploy.addDependency(build);

  return _app;
}
