import { App, Stack, Workflow, Job, RunnerLabel, WorkflowDispatchInputType, expr } from '#src/index.ts';
import { checkoutV4 } from '../src/actions.js';

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'reusable');

  const reusable = new Workflow(stack, 'build-reusable', {
    name: 'Reusable Build',
    on: {
      workflowCall: {
        inputs: {
          nodeVersion: {
            type: WorkflowDispatchInputType.STRING,
            description: 'Node.js version',
            required: true,
          },
          uploadArtifact: {
            type: WorkflowDispatchInputType.BOOLEAN,
            description: 'Upload build artifact',
            required: false,
            default: true,
          },
        },
        outputs: {
          buildHash: {
            description: 'SHA of the build output',
            value: `${expr('jobs.build.outputs.hash')}`,
          },
        },
        secrets: {
          npmToken: { required: true },
          sentryDsn: { required: false },
        },
      },
    },
  });

  new Job(reusable, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [checkoutV4(), { name: 'Build', run: 'npm run build' }],
  });

  const caller = new Workflow(stack, 'release', {
    name: 'Release',
    on: { push: { tags: ['v*'] } },
  });

  new Job(caller, 'call-build', {
    uses: reusable,
    with: { nodeVersion: '20', uploadArtifact: true },
    secrets: 'inherit',
  });

  return _app;
}
