import { Workflow, Job, RunnerLabel, defineAction, createMatrixProxy, github } from '#src/index.ts';
import type { PermissionsMap, RunStep, UsesStep, StepConfig, Expression, StringMap } from '#src/index.ts';

const workflow = undefined as any as Workflow;

// @ts-expect-error — bare string not assignable to RunnerLabel
new Job(workflow, 'bad-runner', { runsOn: 'ubuntu-latest', steps: [] });

// @ts-expect-error — 'read' not assignable to id-token (only 'write' | 'none')
const _perms: PermissionsMap = { idToken: 'read' };

// @ts-expect-error — 'write' not assignable to models (only 'read' | 'none')
const _perms2: PermissionsMap = { models: 'write' };

// @ts-expect-error — run and uses on same step
const _step: StepConfig = { run: 'echo hi', uses: 'actions/checkout@v4' };

// @ts-expect-error — shell on a uses step
const _usesStep: UsesStep = { uses: 'actions/checkout@v4', shell: 'bash' };

// @ts-expect-error — with on a run step
const _runStep: RunStep = { run: 'echo hi', with: { foo: 'bar' } };

const job = new Job(workflow, 'matrix-test', {
  runsOn: RunnerLabel.UBUNTU_LATEST,
  strategy: {
    matrix: {
      os: ['ubuntu-latest', 'windows-latest'],
      node: [16, 18],
    } as const,
  },
  steps: [{ run: 'echo test' }],
});

// @ts-expect-error — nonexistent matrix key
job.matrix.nonexistent;

const _checkoutV4 = defineAction<
  {
    repository: { default: '${{ github.repository }}' };
    ref: { default: '' };
    token: { default: '${{ github.token }}' };
  },
  {
    ref: {};
    commit: {};
  }
>('actions/checkout@v4');

const _uploadArtifactV4 = defineAction<
  {
    name: { required: true };
    path: { required: true };
  },
  {
    artifactId: {};
  }
>('actions/upload-artifact@v4');

// @ts-expect-error — unknown input key on typed action ref
_checkoutV4({ id: 'x', with: { branchName: 'main' } });

// @ts-expect-error — missing required input on typed action ref
_uploadArtifactV4({ id: 'x', with: { path: 'dist/' } });

// @ts-expect-error — unknown output key on typed action ref
_checkoutV4({ id: 'x' }).outputs.digest;

// @ts-expect-error — addOutput not available on non-workflowCall workflows
job.addOutput('hash', 'hash', 'Build hash');

const _envMap: StringMap = { user: github.actor };

import { WorkflowDispatchInputType, eq, type WorkflowInputsProxy, type DeepExpression } from '#src/index.ts';

const dispatchWorkflow = new Workflow(undefined as any, 'dispatch', {
  name: 'Dispatch',
  on: {
    workflowDispatch: {
      inputs: {
        project: {
          description: 'Project',
          required: true,
          type: WorkflowDispatchInputType.CHOICE,
          options: ['app', 'api'],
        },
        dryRun: {
          description: 'Dry run',
          required: false,
          type: WorkflowDispatchInputType.BOOLEAN,
        },
      },
    },
  },
});

const _project: DeepExpression<string> = dispatchWorkflow.inputs.project;
const _dryRun: DeepExpression<string> = dispatchWorkflow.inputs.dryRun;
const _cond = eq(dispatchWorkflow.inputs.project, 'app');

// @ts-expect-error — nonexistent input key
dispatchWorkflow.inputs.nonexistent;
