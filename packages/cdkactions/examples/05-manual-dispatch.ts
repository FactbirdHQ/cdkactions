import { App, Stack, Workflow, Job, RunnerLabel, WorkflowDispatchInputType, expression, eq } from '#src/index.ts';

const { github } = expression;

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'deploy');

  const workflow = new Workflow(stack, 'deploy-manual', {
    name: 'Manual Deploy',
    runName: `Deploy by ${github.actor}`,
    on: {
      workflowDispatch: {
        inputs: {
          environment: {
            type: WorkflowDispatchInputType.ENVIRONMENT,
            description: 'Target environment',
            required: true,
          },
          dryRun: {
            type: WorkflowDispatchInputType.BOOLEAN,
            description: 'Dry run only',
            required: false,
            default: false,
          },
          logLevel: {
            type: WorkflowDispatchInputType.CHOICE,
            description: 'Log verbosity',
            required: true,
            options: ['debug', 'info', 'warn', 'error'],
          },
          concurrency: {
            type: WorkflowDispatchInputType.NUMBER,
            description: 'Parallel deploy count',
            required: false,
            default: '1',
          },
        },
      },
    },
  });

  new Job(workflow, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: eq(workflow.inputs.logLevel, 'debug'),
    steps: [{ name: 'Deploy', run: `echo "Deploying to ${workflow.inputs.environment}"` }],
  });

  return _app;
}
