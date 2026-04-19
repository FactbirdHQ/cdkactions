import { App, Stack, Workflow, Job, RunnerLabel } from '#src/index.js';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'cross-wf');

  const ci = new Workflow(stack, 'ci', {
    name: 'CI',
    on: { push: { branches: ['main'] } },
  });

  new Job(ci, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ name: 'Build', run: 'npm run build' }],
  });

  const deploy = new Workflow(stack, 'deploy', {
    name: 'Deploy',
    on: { push: { branches: ['main'] } },
  });
  deploy.addDependency(ci);

  new Job(deploy, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ name: 'Deploy', run: 'echo deploying' }],
  });

  return _app;
}
