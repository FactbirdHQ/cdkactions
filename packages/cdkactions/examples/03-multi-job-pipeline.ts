import { App, Stack, Workflow, Job, RunnerLabel, eq } from '#src/index.ts';
import { checkoutV4, uploadArtifactV4, downloadArtifactV4 } from '#src/actions.ts';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'pipeline');

  const workflow = new Workflow(stack, 'pipeline', {
    name: 'Build → Test → Deploy',
    on: { push: { branches: ['main'] } },
  });

  const upload = uploadArtifactV4({ id: 'upload', with: { name: 'dist', path: 'dist/' } });
  const build = new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    outputs: { artifact_id: upload.outputs.artifactId },
    steps: [checkoutV4(), { name: 'Build', run: 'npm run build' }, upload],
  });

  const test = new Job(workflow, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [checkoutV4(), { name: 'Test', run: 'npm test' }],
  });
  test.addDependency(build);

  const deploy = new Job(workflow, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: (github) => eq(github.ref, 'refs/heads/main'),
    environment: 'production',
    steps: [
      downloadArtifactV4({ name: 'Download artifact', with: { name: 'dist' } }),
      { name: 'Deploy', run: './deploy.sh' },
    ],
  });
  deploy.addDependency(test);

  const notify = new Job(workflow, 'notify', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ name: 'Notify', run: 'echo "Pipeline finished"' }],
  });
  notify.addDependency(deploy, { condition: 'always' });

  return _app;
}
