import { Node } from 'constructs';

import { App, Stack, Workflow, Job, RunnerLabel, CronExpression, validateCronExpression, collectValidationErrors } from '#@/index.js';
import type { StepConfig, ScheduleEvent, WorkflowProps } from '#@/index.js';
import { checkoutV4 } from '../src/actions.js';
import { TestingApp } from './utils.js';

function createTestApp(options: { createValidateWorkflow?: boolean } = {}) {
  return TestingApp({ createValidateWorkflow: false, ...options });
}

function createTestWorkflow(app: App, workflowProps: Partial<WorkflowProps> = {}) {
  const stack = new Stack(app, 'test-stack');
  return new Workflow(stack, 'test-workflow', {
    name: 'Test',
    on: 'push',
    ...workflowProps,
  });
}

test('step mutual exclusion: run and uses both set', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'bad-job', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{
      id: 'bad-step',
      run: 'echo hello',
      uses: 'actions/checkout@v4',
    } as unknown as StepConfig],
  });

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain("'run' and 'uses' are mutually exclusive");
  expect(errors[0]).toContain('bad-step');
});

test('step mutual exclusion: uses step name in error message', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'bad-job', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{
      name: 'My Step',
      run: 'echo hello',
      uses: 'actions/checkout@v4',
    } as unknown as StepConfig],
  });

  const errors = collectValidationErrors(app);
  expect(errors[0]).toContain('My Step');
});

test('step mutual exclusion: valid steps pass', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'good-job', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      { run: 'echo hello' },
      checkoutV4.call({}),
    ],
  });

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(0);
});

test('runsOn required when uses not set', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'no-runner', {
    steps: [{ run: 'echo hello' }],
  });

  const errors = collectValidationErrors(app);
  expect(errors.some(e => e.includes("'runsOn' is required"))).toBe(true);
});

test('runsOn not required when uses (reusable workflow) is set', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'reusable', {
    uses: 'org/repo/.github/workflows/reusable.yml@main',
  });

  const errors = collectValidationErrors(app);
  expect(errors.filter(e => e.includes("'runsOn' is required"))).toHaveLength(0);
});

test('matrix size warning: exceeds 256 combinations', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'big-matrix', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: {
        os: ['ubuntu', 'windows', 'macos'] as const,
        node: ['14', '16', '18', '20'] as const,
        arch: ['x64', 'arm64'] as const,
        variant: Array.from({ length: 12 }, (_, i) => `v${i}`) as unknown as readonly string[],
      },
    },
    steps: [{ run: 'echo test' }],
  });

  const errors = collectValidationErrors(app);
  expect(errors.some(e => e.includes('exceeding GitHub\'s limit of 256'))).toBe(true);
});

test('matrix size: within 256 passes', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'ok-matrix', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: {
        os: ['ubuntu', 'windows'] as const,
        node: ['18', '20'] as const,
      },
    },
    steps: [{ run: 'echo test' }],
  });

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(0);
});

test('step limit: exceeds 1000 steps', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  const steps: StepConfig[] = Array.from({ length: 1001 }, (_, i) => ({
    run: `echo step ${i}`,
  }));
  new Job(workflow, 'many-steps', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps,
  });

  const errors = collectValidationErrors(app);
  expect(errors.some(e => e.includes('exceeding the recommended limit of 1000'))).toBe(true);
});

test('step limit: exactly 1000 steps passes', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  const steps: StepConfig[] = Array.from({ length: 1000 }, (_, i) => ({
    run: `echo step ${i}`,
  }));
  new Job(workflow, 'many-steps', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps,
  });

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(0);
});

test('branches and branchesIgnore mutual exclusion on push event', () => {
  const app = createTestApp();
  createTestWorkflow(app, {
    on: {
      push: {
        branches: ['main'],
        branchesIgnore: ['feature/*'],
      },
    },
  } as unknown as Partial<WorkflowProps>);

  const errors = collectValidationErrors(app);
  expect(errors.some(e => e.includes("'branches' and 'branchesIgnore' are mutually exclusive"))).toBe(true);
});

test('branches and branchesIgnore mutual exclusion on pullRequest event', () => {
  const app = createTestApp();
  createTestWorkflow(app, {
    on: {
      pullRequest: {
        branches: ['main'],
        branchesIgnore: ['feature/*'],
      },
    },
  } as unknown as Partial<WorkflowProps>);

  const errors = collectValidationErrors(app);
  expect(errors.some(e => e.includes("'branches' and 'branchesIgnore' are mutually exclusive"))).toBe(true);
});

test('branches without branchesIgnore passes', () => {
  const app = createTestApp();
  createTestWorkflow(app, {
    on: {
      push: {
        branches: ['main'],
      },
    },
  } as unknown as Partial<WorkflowProps>);

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(0);
});

test('cron validation: valid expressions pass', () => {
  expect(validateCronExpression('0 0 * * *')).toHaveLength(0);
  expect(validateCronExpression('*/15 * * * *')).toHaveLength(0);
  expect(validateCronExpression('0 9 * * 1-5')).toHaveLength(0);
  expect(validateCronExpression('30 4 1,15 * *')).toHaveLength(0);
});

test('cron validation: wrong number of fields', () => {
  const errors = validateCronExpression('0 0 * *');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('must have exactly 5 fields');
});

test('cron validation: out of range values', () => {
  const errors = validateCronExpression('60 0 * * *');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('minute');
  expect(errors[0]).toContain('outside 0-59');
});

test('cron validation: invalid hour', () => {
  const errors = validateCronExpression('0 25 * * *');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('hour');
});

test('cron validation: invalid day of month', () => {
  const errors = validateCronExpression('0 0 32 * *');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('day of month');
});

test('cron validation: invalid month', () => {
  const errors = validateCronExpression('0 0 * 13 *');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('month');
});

test('cron validation: invalid day of week', () => {
  const errors = validateCronExpression('0 0 * * 7');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('day of week');
});

test('cron validation: invalid range', () => {
  const errors = validateCronExpression('5-2 * * * *');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('start greater than end');
});

test('cron validation integrated with workflow', () => {
  const app = createTestApp();
  const stack = new Stack(app, 'cron-stack');
  new Workflow(stack, 'cron-workflow', {
    name: 'Cron Test',
    on: {
      schedule: [{ cron: '0 25 * * *' }],
    },
  } as unknown as WorkflowProps);

  const errors = collectValidationErrors(app);
  expect(errors.some(e => e.includes('hour'))).toBe(true);
});

test('valid cron in workflow passes', () => {
  const app = createTestApp();
  const stack = new Stack(app, 'cron-stack');
  new Workflow(stack, 'cron-workflow', {
    name: 'Cron Test',
    on: {
      schedule: [{ cron: '0 0 * * *' }],
    },
  } as unknown as WorkflowProps);

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(0);
});

test('validations run during app.synth() and throw', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'invalid', {
    steps: [{ run: 'echo hello' }],
  });

  expect(() => app.synth()).toThrow('Validation failed');
});

test('app.synth() succeeds with valid constructs', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'valid', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'echo hello' }],
  });

  expect(() => app.synth()).not.toThrow();
});

test('validation error messages are actionable', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'my-job', {
    steps: [{
      id: 'conflicting',
      run: 'echo hello',
      uses: 'actions/checkout@v4',
    } as unknown as StepConfig],
  });

  const errors = collectValidationErrors(app);
  for (const error of errors) {
    expect(error).toMatch(/Job '.+'/);
  }
});

test('multiple validation errors collected', () => {
  const app = createTestApp();
  const workflow = createTestWorkflow(app);
  new Job(workflow, 'job1', {
    steps: [{ run: 'echo hello' }],
  });
  new Job(workflow, 'job2', {
    steps: [{ run: 'echo hello' }],
  });

  const errors = collectValidationErrors(app);
  expect(errors.filter(e => e.includes("'runsOn' is required"))).toHaveLength(2);
});

test('CronExpression: valid expression creates instance', () => {
  const cron = new CronExpression('0 0 * * *');
  expect(cron.expression).toBe('0 0 * * *');
  expect(cron.toString()).toBe('0 0 * * *');
});

test('CronExpression: complex valid expressions', () => {
  expect(new CronExpression('*/15 * * * *').toString()).toBe('*/15 * * * *');
  expect(new CronExpression('0 9 * * 1-5').toString()).toBe('0 9 * * 1-5');
  expect(new CronExpression('30 4 1,15 * *').toString()).toBe('30 4 1,15 * *');
});

test('CronExpression: throws on invalid expression', () => {
  // @ts-expect-error — intentionally invalid cron for runtime validation test
  expect(() => new CronExpression('0 25 * * *')).toThrow('hour');
  // @ts-expect-error — intentionally invalid cron for runtime validation test
  expect(() => new CronExpression('0 0 * *')).toThrow('must have exactly 5 fields');
  // @ts-expect-error — intentionally invalid cron for runtime validation test
  expect(() => new CronExpression('60 0 * * *')).toThrow('minute');
});

test('CronExpression: used in ScheduleEntry', () => {
  const app = createTestApp();
  const stack = new Stack(app, 'cron-stack');
  new Workflow(stack, 'cron-workflow', {
    name: 'Cron Test',
    on: {
      schedule: [{ cron: new CronExpression('0 0 * * *') }],
    },
  } as unknown as WorkflowProps);

  const errors = collectValidationErrors(app);
  expect(errors).toHaveLength(0);
});

test('CronExpression: serializes to string in toGHAction', () => {
  const app = createTestApp();
  const stack = new Stack(app, 'cron-stack');
  const workflow = new Workflow(stack, 'cron-workflow', {
    name: 'Cron Test',
    on: {
      schedule: [{ cron: new CronExpression('*/15 * * * *') }],
    },
  } as unknown as WorkflowProps);
  new Job(workflow, 'test-job', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'echo test' }],
  });

  const output = workflow.toGHAction();
  expect(output.on.schedule[0].cron).toBe('*/15 * * * *');
});

function _cronTypeTests() {
  // @ts-expect-error — invalid cron expression caught at compile time
  new CronExpression('invalid cron');
  // @ts-expect-error — too few fields
  new CronExpression('0 0 * *');
  // @ts-expect-error — hour 25 out of range
  new CronExpression('0 25 * * *');

  new CronExpression('0 0 * * *');
  new CronExpression('*/15 * * * *');
}
void _cronTypeTests;

test('CronExpression constructor: creates instance from dynamic string', () => {
  const dynamic = '0 0 * * *' as string;
  const cron = new CronExpression(dynamic);
  expect(cron).toBeInstanceOf(CronExpression);
  expect(cron.toString()).toBe('0 0 * * *');
});

test('CronExpression constructor: throws on invalid dynamic string', () => {
  expect(() => new CronExpression('0 25 * * *' as string)).toThrow('hour');
});
