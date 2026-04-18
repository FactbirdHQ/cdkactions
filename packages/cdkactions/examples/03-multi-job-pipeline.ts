import {
  App, Stack, Workflow, Job, RunnerLabel,
  eq, github,
} from '#@/index.js';
import { checkoutV4 } from '../src/actions.js';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'pipeline');

  const workflow = new Workflow(stack, 'pipeline', {
    name: 'Build → Test → Deploy',
    on: { push: { branches: ['main'] } },
  });

  const build = new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    outputs: { artifact_id: '${{ steps.upload.outputs.artifact-id }}' },
    steps: [
      checkoutV4.call({}),
      { name: 'Build', run: 'npm run build' },
      {
        id: 'upload',
        name: 'Upload',
        uses: 'actions/upload-artifact@v4',
        with: { name: 'dist', path: 'dist/' },
      },
    ],
  });

  const test = new Job(workflow, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      checkoutV4.call({}),
      { name: 'Test', run: 'npm test' },
    ],
  });
  test.addDependency(build);

  const deploy = new Job(workflow, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: eq(github.ref, 'refs/heads/main'),
    environment: 'production',
    steps: [
      {
        name: 'Download artifact',
        uses: 'actions/download-artifact@v4',
        with: { name: 'dist' },
      },
      { name: 'Deploy', run: './deploy.sh' },
    ],
  });
  deploy.addDependency(test);

  const notify = new Job(workflow, 'notify', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      { name: 'Notify', run: 'echo "Pipeline finished"' },
    ],
  });
  notify.addDependency(deploy, { condition: 'always' });

  return _app;
}
