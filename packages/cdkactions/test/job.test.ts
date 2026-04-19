import type {
  ConcurrencyConfig,
  EnvironmentConfig,
  Expression,
  JobProps,
  MatrixDefinition,
  RunnerGroupConfig,
  RunStep,
  ServiceProps,
  StepConfig,
  StrategyProps,
  UsesStep,
} from '#@/index.js';
import { always, Condition, createMatrixProxy, eq, failure, github, Job, RunnerLabel } from '#@/index.js';
import { checkoutV4 } from '../src/actions.js';

test('toGHAction', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    continueOnError: true,
    timeoutMinutes: 10,
    strategy: {
      failFast: true,
      maxParallel: 11,
    },
    steps: [
      {
        name: 'step',
        run: 'echo hello',
        continueOnError: false,
        timeoutMinutes: 5,
        workingDirectory: '~/',
      },
      {
        name: 'External action',
        uses: 'actions/checkout@v2',
        with: {
          stringValue: 'string',
          numberValue: 10,
          booleanValue: false,
        },
      },
    ],
  });
  expect(job.toGHAction()).toMatchSnapshot();
});

test('job permissions with full PermissionsMap', () => {
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    permissions: {
      contents: 'read',
      packages: 'write',
      idToken: 'write',
      pullRequests: 'none',
      artifactMetadata: 'read',
      securityEvents: 'read',
      repositoryProjects: 'none',
    },
  });
  const ghAction = job.toGHAction();
  expect(ghAction.permissions).toEqual({
    contents: 'read',
    packages: 'write',
    'id-token': 'write',
    'pull-requests': 'none',
    'artifact-metadata': 'read',
    'security-events': 'read',
    'repository-projects': 'none',
  });
});

test('job permissions with read-all shorthand', () => {
  const job = new Job(undefined as any, 'readonly', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    permissions: 'read-all',
  });
  const ghAction = job.toGHAction();
  expect(ghAction.permissions).toBe('read-all');
});

test('environment string form', () => {
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    environment: 'production',
  });
  const ghAction = job.toGHAction();
  expect(ghAction.environment).toBe('production');
});

test('environment object form', () => {
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    environment: { name: 'production', url: 'https://prod.example.com' },
  });
  const ghAction = job.toGHAction();
  expect(ghAction.environment).toEqual({
    name: 'production',
    url: 'https://prod.example.com',
  });
});

test('concurrency string form', () => {
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    concurrency: 'deploy-group',
  });
  const ghAction = job.toGHAction();
  expect(ghAction.concurrency).toBe('deploy-group');
});

test('concurrency object form with cancelInProgress', () => {
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    concurrency: { group: 'deploy-${{ github.ref }}', cancelInProgress: true },
  });
  const ghAction = job.toGHAction();
  expect(ghAction.concurrency).toEqual({
    group: 'deploy-${{ github.ref }}',
    'cancel-in-progress': true,
  });
});

test('secrets inherit', () => {
  const job = new Job(undefined as any, 'reusable', {
    uses: 'org/repo/.github/workflows/deploy.yml@main',
    secrets: 'inherit',
  });
  const ghAction = job.toGHAction();
  expect(ghAction.secrets).toBe('inherit');
  expect(ghAction.uses).toBe('org/repo/.github/workflows/deploy.yml@main');
});

test('secrets as record', () => {
  const job = new Job(undefined as any, 'reusable', {
    uses: 'org/repo/.github/workflows/deploy.yml@main',
    secrets: {
      token: '${{ secrets.DEPLOY_TOKEN }}' as Expression<string>,
      apiKey: 'literal-key',
    },
  });
  const ghAction = job.toGHAction();
  expect(ghAction.secrets).toEqual({
    token: '${{ secrets.DEPLOY_TOKEN }}',
    apiKey: 'literal-key',
  });
});

test('external uses as string', () => {
  const job = new Job(undefined as any, 'reusable', {
    uses: 'org/repo/.github/workflows/build.yml@v1',
  });
  const ghAction = job.toGHAction();
  expect(ghAction.uses).toBe('org/repo/.github/workflows/build.yml@v1');
});

test('runner group config', () => {
  const job = new Job(undefined as any, 'deploy', {
    runsOn: {
      group: 'large-runners',
      labels: [RunnerLabel.UBUNTU_LATEST, RunnerLabel.custom('gpu')],
    },
    steps: [],
  });
  const ghAction = job.toGHAction();
  expect(ghAction['runs-on']).toEqual({
    group: 'large-runners',
    labels: ['ubuntu-latest', 'gpu'],
  });
});

test('runsOn with RunnerLabel array', () => {
  const job = new Job(undefined as any, 'build', {
    runsOn: [RunnerLabel.SELF_HOSTED, RunnerLabel.custom('linux')],
    steps: [],
  });
  const ghAction = job.toGHAction();
  expect(ghAction['runs-on']).toEqual(['self-hosted', 'linux']);
});

test('runsOn with Expression<string>', () => {
  const job = new Job(undefined as any, 'matrix', {
    runsOn: '${{ matrix.os }}' as Expression<string>,
    steps: [],
  });
  const ghAction = job.toGHAction();
  expect(ghAction['runs-on']).toBe('${{ matrix.os }}');
});

// Type-level: JobProps.permissions accepts Permissions type
const _jobWithPerms: Pick<JobProps, 'permissions'> = {
  permissions: { contents: 'read', idToken: 'write' },
};
const _jobReadAll: Pick<JobProps, 'permissions'> = {
  permissions: 'read-all',
};

// Type-level: bare string is not assignable to runsOn
// @ts-expect-error - bare string should not be assignable to RunnerLabel
const _bareStringRunsOn: Pick<JobProps, 'runsOn'> = { runsOn: 'ubuntu-latest' };

// Type-level: EnvironmentConfig accepts both forms
const _envString: EnvironmentConfig = 'production';
const _envObject: EnvironmentConfig = {
  name: 'staging',
  url: 'https://staging.example.com',
};

// Type-level: ConcurrencyConfig accepts both forms
const _concString: ConcurrencyConfig = 'my-group';
const _concObject: ConcurrencyConfig = {
  group: 'deploy',
  cancelInProgress: true,
};

// Type-level: RunnerGroupConfig
const _runnerGroup: RunnerGroupConfig = {
  group: 'large',
  labels: [RunnerLabel.UBUNTU_LATEST],
};

test('RunStep serialization', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Run tests',
        run: 'npm test',
        workingDirectory: 'packages/core',
      },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps).toEqual([
    {
      name: 'Run tests',
      run: 'npm test',
      'working-directory': 'packages/core',
    },
  ]);
});

test('UsesStep serialization', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Checkout',
        uses: 'actions/checkout@v4',
        with: { fetchDepth: 0 },
      },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps).toEqual([
    {
      name: 'Checkout',
      uses: 'actions/checkout@v4',
      with: { fetchDepth: 0 },
    },
  ]);
});

test('step if with Condition', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Deploy',
        run: 'deploy.sh',
        if: Condition.from("github.ref == 'refs/heads/main'"),
      },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps[0].if).toBe("github.ref == 'refs/heads/main'");
});

test('step if with Expression<boolean>', () => {
  const expr = "github.event_name == 'push'" as Expression<boolean>;
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Push only',
        run: 'echo push',
        if: expr,
      },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps[0].if).toBe("github.event_name == 'push'");
});

test('step continueOnError and timeoutMinutes serialization', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Flaky step',
        run: 'flaky-test.sh',
        continueOnError: true,
        timeoutMinutes: 30,
      },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps[0]['continue-on-error']).toBe(true);
  expect(ghAction.steps[0]['timeout-minutes']).toBe(30);
});

test('mixed RunStep and UsesStep in same job', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      checkoutV4(),
      { run: 'npm install' },
      { uses: 'actions/setup-node@v4', with: { nodeVersion: '20' } },
      { run: 'npm test', workingDirectory: 'packages/core' },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps).toHaveLength(4);
  expect(ghAction.steps[0].uses).toBe('actions/checkout@v4');
  expect(ghAction.steps[1].run).toBe('npm install');
  expect(ghAction.steps[2].uses).toBe('actions/setup-node@v4');
  expect(ghAction.steps[3].run).toBe('npm test');
  expect(ghAction.steps[3]['working-directory']).toBe('packages/core');
});

// Type-level: RunStep requires run, UsesStep requires uses
const _runStep: RunStep = { run: 'echo hello' };
const _usesStep: UsesStep = { uses: 'actions/checkout@v4' };

// Type-level: run + uses together is a compile error
// @ts-expect-error - cannot have both run and uses
const _invalidBoth: StepConfig = { run: 'echo', uses: 'actions/checkout@v4' };

// Type-level: shell on UsesStep is a compile error
// @ts-expect-error - shell is not allowed on UsesStep
const _invalidShell: UsesStep = { uses: 'actions/checkout@v4', shell: 'bash' };

// Type-level: with on RunStep is a compile error
// @ts-expect-error - with is not allowed on RunStep
const _invalidWith: RunStep = { run: 'echo', with: { key: 'value' } };

// Type-level: workingDirectory on UsesStep is a compile error
// @ts-expect-error - workingDirectory is not allowed on UsesStep
const _invalidWd: UsesStep = {
  uses: 'actions/checkout@v4',
  workingDirectory: '~/',
};

// Type-level: step if accepts Condition
const _stepWithCondition: StepConfig = {
  run: 'echo',
  if: Condition.from('true'),
};

// Type-level: step if accepts Expression<boolean>
const _stepWithExpr: StepConfig = {
  run: 'echo',
  if: 'true' as Expression<boolean>,
};

test('generic matrix strategy serialization', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: {
        os: ['ubuntu-latest', 'windows-latest'],
        node: [16, 18, 20],
      } as const,
      include: [{ os: 'ubuntu-latest', node: 20 }],
      exclude: [{ os: 'windows-latest', node: 16 }],
      failFast: false,
      maxParallel: 3,
    },
    steps: [{ run: 'echo hello' }],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.strategy).toEqual({
    matrix: {
      os: ['ubuntu-latest', 'windows-latest'],
      node: [16, 18, 20],
      include: [{ os: 'ubuntu-latest', node: 20 }],
      exclude: [{ os: 'windows-latest', node: 16 }],
    },
    'fail-fast': false,
    'max-parallel': 3,
  });
});

test('typed matrix accessor returns expression strings', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: {
        os: ['ubuntu-latest', 'windows-latest'],
        node: [16, 18],
      } as const,
    },
    steps: [{ run: 'echo hello' }],
  });
  expect(job.matrix.os).toBe('${{ matrix.os }}');
  expect(job.matrix.node).toBe('${{ matrix.node }}');
});

test('createMatrixProxy produces correct expression strings', () => {
  const proxy = createMatrixProxy({
    os: ['ubuntu-latest', 'windows-latest'],
    version: [1, 2, 3],
  } as const);
  expect(proxy.os).toBe('${{ matrix.os }}');
  expect(proxy.version).toBe('${{ matrix.version }}');
});

test('failFast serializes as fail-fast', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      failFast: true,
    },
    steps: [{ run: 'echo hello' }],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.strategy['fail-fast']).toBe(true);
  expect(ghAction.strategy.failFast).toBeUndefined();
});

// Type-level: StrategyProps with typed matrix
const _typedStrategy: StrategyProps<{
  readonly os: readonly ['ubuntu-latest', 'windows-latest'];
  readonly node: readonly [16, 18];
}> = {
  matrix: {
    os: ['ubuntu-latest', 'windows-latest'],
    node: [16, 18],
  },
  include: [{ os: 'ubuntu-latest' }],
  exclude: [{ node: 16 }],
  failFast: true,
};

// Type-level: include/exclude constrained to matrix value types
const _invalidInclude: StrategyProps<{
  readonly os: readonly ['ubuntu-latest', 'windows-latest'];
}> = {
  matrix: { os: ['ubuntu-latest', 'windows-latest'] },
  // @ts-expect-error - include entry with invalid os value
  include: [{ os: 'macos-latest' }],
};

// Type-level: typed matrix proxy prevents nonexistent key access
{
  const matrixDef = { os: ['ubuntu-latest'], node: [16] } as const;
  const proxy = createMatrixProxy(matrixDef);
  const _os: Expression<'ubuntu-latest'> = proxy.os;
  const _node: Expression<16> = proxy.node;
  // @ts-expect-error - nonexistent matrix key
  const _bad: Expression<unknown> = proxy.nonexistent;
}

test('service with command and entrypoint', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'echo hello' }],
    services: {
      redis: {
        image: 'redis:7',
        ports: ['6379:6379'],
        options: '--health-cmd "redis-cli ping"',
      },
      postgres: {
        image: 'postgres:16',
        env: { POSTGRES_PASSWORD: 'test' },
        ports: ['5432:5432'],
        command: '--max-connections=200',
        entrypoint: '/usr/local/bin/docker-entrypoint.sh',
      },
    },
  });
  const ghAction = job.toGHAction();
  expect(ghAction.services.redis).toEqual({
    image: 'redis:7',
    ports: ['6379:6379'],
    options: '--health-cmd "redis-cli ping"',
  });
  expect(ghAction.services.postgres).toEqual({
    image: 'postgres:16',
    env: { POSTGRES_PASSWORD: 'test' },
    ports: ['5432:5432'],
    command: '--max-connections=200',
    entrypoint: '/usr/local/bin/docker-entrypoint.sh',
  });
});

test('service without command and entrypoint', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'echo hello' }],
    services: {
      redis: {
        image: 'redis:7',
      },
    },
  });
  const ghAction = job.toGHAction();
  expect(ghAction.services.redis).toEqual({ image: 'redis:7' });
  expect(ghAction.services.redis.command).toBeUndefined();
  expect(ghAction.services.redis.entrypoint).toBeUndefined();
});

// Type-level: ServiceProps extends DockerProps with command and entrypoint
const _serviceWithExtras: ServiceProps = {
  image: 'postgres:16',
  command: '--max-connections=200',
  entrypoint: '/entrypoint.sh',
};
const _serviceWithoutExtras: ServiceProps = { image: 'redis:7' };

test('Condition.from accepts Expression<boolean>', () => {
  const expr = eq(github.ref, 'refs/heads/main');
  const condition = Condition.from(expr);
  expect(condition.toString()).toBe("github.ref == 'refs/heads/main'");
});

test('Condition.fromExpr creates condition from expression', () => {
  const expr = eq(github.ref, 'refs/heads/main');
  const condition = Condition.fromExpr(expr);
  expect(condition.toString()).toBe("github.ref == 'refs/heads/main'");
});

test('Condition.toExpression wraps in ${{ }}', () => {
  const condition = Condition.from("github.ref == 'refs/heads/main'");
  expect(condition.toExpression()).toBe("${{ github.ref == 'refs/heads/main' }}");
});

test('Condition.toExpression returns empty string for empty condition', () => {
  const condition = Condition.from('');
  expect(condition.toExpression()).toBe('');
});

test('job if with Expression<boolean> serializes without ${{ }}', () => {
  const expr = eq(github.ref, 'refs/heads/main');
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: expr,
    steps: [{ run: 'deploy.sh' }],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.if).toBe("github.ref == 'refs/heads/main'");
});

test('job if with Condition serializes without ${{ }}', () => {
  const condition = Condition.from("github.ref == 'refs/heads/main'");
  const job = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: condition,
    steps: [{ run: 'deploy.sh' }],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.if).toBe("github.ref == 'refs/heads/main'");
});

test('addDependency with condition: always augments if with always()', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const notify = new Job(undefined as any, 'notify', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'notify.sh' }],
  });
  notify.addDependency(build, { condition: 'always' });

  const ghAction = notify.toGHAction();
  expect(ghAction.needs).toEqual(['build']);
  expect(ghAction.if).toBe('always()');
});

test('addDependency with condition: failure augments if with failure()', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const rollback = new Job(undefined as any, 'rollback', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'rollback.sh' }],
  });
  rollback.addDependency(build, { condition: 'failure' });

  const ghAction = rollback.toGHAction();
  expect(ghAction.needs).toEqual(['build']);
  expect(ghAction.if).toBe('failure()');
});

test('addDependency with condition: completed augments if with always()', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const cleanup = new Job(undefined as any, 'cleanup', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'cleanup.sh' }],
  });
  cleanup.addDependency(build, { condition: 'completed' });

  const ghAction = cleanup.toGHAction();
  expect(ghAction.if).toBe('always()');
});

test('addDependency with condition: success augments if with success()', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const deploy = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'deploy.sh' }],
  });
  deploy.addDependency(build, { condition: 'success' });

  const ghAction = deploy.toGHAction();
  expect(ghAction.if).toBe('success()');
});

test('addDependency without condition does not set if', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const test = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'test.sh' }],
  });
  test.addDependency(build);

  const ghAction = test.toGHAction();
  expect(ghAction.needs).toEqual(['build']);
  expect(ghAction.if).toBeUndefined();
});

test('multiple addDependency with conditions composes if with &&', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const test = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'test.sh' }],
  });
  const notify = new Job(undefined as any, 'notify', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'notify.sh' }],
  });
  notify.addDependency(build, { condition: 'always' });
  notify.addDependency(test, { condition: 'always' });

  const ghAction = notify.toGHAction();
  expect(ghAction.needs).toEqual(['build', 'test']);
  expect(ghAction.if).toBe('(always() && always())');
});

test('job if from props merges with addDependency condition', () => {
  const build = new Job(undefined as any, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const deploy = new Job(undefined as any, 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: eq(github.ref, 'refs/heads/main'),
    steps: [{ run: 'deploy.sh' }],
  });
  deploy.addDependency(build, { condition: 'success' });

  const ghAction = deploy.toGHAction();
  expect(ghAction.if).toBe("(success() && github.ref == 'refs/heads/main')");
});

test('Condition composed with Expression via and/or', () => {
  const cond = Condition.fromExpr(eq(github.ref, 'refs/heads/main'));
  const alwaysCond = Condition.from('always()');
  const combined = alwaysCond.and(cond);
  expect(combined.toString()).toBe("(always() && github.ref == 'refs/heads/main')");
});

test('step if with Expression emits without ${{ }} wrapping', () => {
  const expr = eq(github.eventName, 'push');
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Push only',
        run: 'echo push',
        if: expr,
      },
    ],
  });
  const ghAction = job.toGHAction();
  expect(ghAction.steps[0].if).toBe("github.event_name == 'push'");
});

// Type-level: JobProps.if accepts Condition
const _jobIfCondition: Pick<JobProps, 'if'> = { if: Condition.from('true') };

// Type-level: JobProps.if accepts Expression<boolean>
const _jobIfExpr: Pick<JobProps, 'if'> = { if: 'true' as Expression<boolean> };

// Type-level: JobProps.if rejects raw string
// @ts-expect-error - raw string should not be assignable to Condition | Expression<boolean>
const _jobIfString: Pick<JobProps, 'if'> = { if: 'raw string' };
