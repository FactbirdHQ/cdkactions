import * as fs from 'fs';
import { CheckoutJob, checkoutV4, Job, RunnerLabel, Stack, Workflow } from '#@/index.js';
import type { StepConfig } from '#@/index.js';
import { TestingApp } from '#$/utils.js';


test('cdkactionsstack', () => {
  const app = TestingApp({ pushUpdatedManifests: true });

  app.synth();
  expect(fs.readdirSync(app.outdir)).toEqual([
    'cdkactions_validate.yaml',
  ]);

  expect(fs.readFileSync(`${app.outdir}/cdkactions_validate.yaml`, 'utf-8')).toMatchSnapshot();
});

test('CheckoutJob prepends checkout step via ActionRef', () => {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'test-stack');
  const workflow = new Workflow(stack, 'ci', {
    name: 'CI',
    on: 'push',
  });
  const job = new CheckoutJob(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'npm test' }],
  });

  const ghAction = job.toGHAction();
  expect(ghAction.steps).toHaveLength(2);
  expect(ghAction.steps[0]).toEqual({ uses: 'actions/checkout@v4' });
  expect(ghAction.steps[1]).toEqual({ run: 'npm test' });
});

test('CheckoutJob with no user steps only has checkout', () => {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'test-stack');
  const workflow = new Workflow(stack, 'ci', {
    name: 'CI',
    on: 'push',
  });
  const job = new CheckoutJob(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
  });

  const ghAction = job.toGHAction();
  expect(ghAction.steps).toHaveLength(1);
  expect(ghAction.steps[0]).toEqual({ uses: 'actions/checkout@v4' });
});

test('checkoutV4 ActionRef produces correct step', () => {
  const step = checkoutV4.call({});
  expect(step.uses).toBe('actions/checkout@v4');
  expect(Object.keys(step)).toEqual(['uses']);
});

test('checkoutV4 ActionRef with inputs', () => {
  const step = checkoutV4.call({ with: { fetchDepth: 0 } });
  expect(step.uses).toBe('actions/checkout@v4');
  expect(step.with).toEqual({ 'fetch-depth': 0 });
});

test('checkoutV4 ActionRef output accessor', () => {
  const step = checkoutV4.call({ id: 'co' });
  expect(step.output('ref' as any)).toBe('steps.co.outputs.ref');
});

test('checkoutV4 step is valid StepConfig', () => {
  const step: StepConfig = checkoutV4.call({});
  expect(step.uses).toBe('actions/checkout@v4');
});

test('CheckoutJob YAML output is backward compatible', () => {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'test-stack');
  const workflow = new Workflow(stack, 'ci', {
    name: 'CI',
    on: 'push',
  });
  new CheckoutJob(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'echo done' }],
  });

  app.synth();
  const yaml = fs.readFileSync(`${app.outdir}/cdkactions_ci.yaml`, 'utf-8');
  expect(yaml).toContain('uses: actions/checkout@v4');
  expect(yaml).not.toContain('output');
});
