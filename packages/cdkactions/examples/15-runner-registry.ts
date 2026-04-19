import {
  App, Stack, Workflow, Job, RunnerLabel,
} from '#@/index.js';

const Runners = {
  ...RunnerLabel,
  CI_LINUX: RunnerLabel.custom('ci-linux-x64'),
  CI_ARM: RunnerLabel.custom('ci-arm64'),
  DEPLOY_PROD: RunnerLabel.custom('deploy-prod'),
  GPU_TRAINING: RunnerLabel.custom('gpu-a100-80gb'),
} as const;

export type OrgRunner = (typeof Runners)[keyof typeof Runners];

export function create(app?: App) {
  const _app = app ?? new App();
  const stack = new Stack(_app, 'runners');

  const workflow = new Workflow(stack, 'custom-runners', {
    name: 'Custom Runners',
    on: { push: { branches: ['main'] } },
  });

  new Job(workflow, 'build-x64', {
    runsOn: Runners.CI_LINUX,
    steps: [{ name: 'Build', run: 'make build' }],
  });

  new Job(workflow, 'build-arm', {
    runsOn: Runners.CI_ARM,
    steps: [{ name: 'Build', run: 'make build ARCH=arm64' }],
  });

  new Job(workflow, 'train', {
    runsOn: Runners.GPU_TRAINING,
    timeoutMinutes: 360,
    steps: [{ name: 'Train model', run: 'python train.py' }],
  });

  return _app;
}
