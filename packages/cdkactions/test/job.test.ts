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
} from '#src/index.ts';
import {
  always,
  and,
  createMatrixProxy,
  eq,
  expr,
  failure,
  github,
  Job,
  resolveTokens,
  RunnerLabel,
  secrets,
  unwrapToken,
} from '#src/index.ts';
import { checkoutV4 } from '#src/actions.ts';
import { TestingWorkflow } from '#test/utils.ts';

/** Simulate the full serialization pipeline (toGHAction + token resolution). */
function serialize(job: Job): any {
  return resolveTokens(job.toGHAction());
}

test('toGHAction', () => {
  const job = new Job(TestingWorkflow(), 'test', {
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
  expect(serialize(job)).toMatchSnapshot();
});

test('job permissions with full PermissionsMap', () => {
  const job = new Job(TestingWorkflow(), 'deploy', {
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
  const ghAction = serialize(job);
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
  const job = new Job(TestingWorkflow(), 'readonly', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    permissions: 'read-all',
  });
  const ghAction = serialize(job);
  expect(ghAction.permissions).toBe('read-all');
});

test('environment string form', () => {
  const job = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    environment: 'production',
  });
  const ghAction = serialize(job);
  expect(ghAction.environment).toBe('production');
});

test('environment object form', () => {
  const job = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    environment: { name: 'production', url: 'https://prod.example.com' },
  });
  const ghAction = serialize(job);
  expect(ghAction.environment).toEqual({
    name: 'production',
    url: 'https://prod.example.com',
  });
});

test('concurrency string form', () => {
  const job = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    concurrency: 'deploy-group',
  });
  const ghAction = serialize(job);
  expect(ghAction.concurrency).toBe('deploy-group');
});

test('concurrency object form with cancelInProgress', () => {
  const job = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
    concurrency: { group: 'deploy-${{ github.ref }}', cancelInProgress: true },
  });
  const ghAction = serialize(job);
  expect(ghAction.concurrency).toEqual({
    group: 'deploy-${{ github.ref }}',
    'cancel-in-progress': true,
  });
});

test('secrets inherit', () => {
  const job = new Job(TestingWorkflow(), 'reusable', {
    uses: 'org/repo/.github/workflows/deploy.yml@main',
    secrets: 'inherit',
  });
  const ghAction = serialize(job);
  expect(ghAction.secrets).toBe('inherit');
  expect(ghAction.uses).toBe('org/repo/.github/workflows/deploy.yml@main');
});

test('secrets as record', () => {
  const job = new Job(TestingWorkflow(), 'reusable', {
    uses: 'org/repo/.github/workflows/deploy.yml@main',
    secrets: {
      token: secrets.DEPLOY_TOKEN,
      apiKey: 'literal-key',
    },
  });
  const ghAction = serialize(job);
  expect(ghAction.secrets).toEqual({
    token: '${{ secrets.DEPLOY_TOKEN }}',
    apiKey: 'literal-key',
  });
});

test('external uses as string', () => {
  const job = new Job(TestingWorkflow(), 'reusable', {
    uses: 'org/repo/.github/workflows/build.yml@v1',
  });
  const ghAction = serialize(job);
  expect(ghAction.uses).toBe('org/repo/.github/workflows/build.yml@v1');
});

test('runner group config', () => {
  const job = new Job(TestingWorkflow(), 'deploy', {
    runsOn: {
      group: 'large-runners',
      labels: [RunnerLabel.UBUNTU_LATEST, RunnerLabel.custom('gpu')],
    },
    steps: [],
  });
  const ghAction = serialize(job);
  expect(ghAction['runs-on']).toEqual({
    group: 'large-runners',
    labels: ['ubuntu-latest', 'gpu'],
  });
});

test('runsOn with RunnerLabel array', () => {
  const job = new Job(TestingWorkflow(), 'build', {
    runsOn: [RunnerLabel.SELF_HOSTED, RunnerLabel.custom('linux')],
    steps: [],
  });
  const ghAction = serialize(job);
  expect(ghAction['runs-on']).toEqual(['self-hosted', 'linux']);
});

test('runsOn with Expression<string> auto-wraps in ${{ }}', () => {
  const job = new Job(TestingWorkflow(), 'matrix', {
    runsOn: expr<string>('matrix.os'),
    steps: [],
  });
  const ghAction = serialize(job);
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
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Run tests',
        run: 'npm test',
        workingDirectory: 'packages/core',
      },
    ],
  });
  const ghAction = serialize(job);
  expect(ghAction.steps).toEqual([
    {
      name: 'Run tests',
      run: 'npm test',
      'working-directory': 'packages/core',
    },
  ]);
});

test('UsesStep serialization', () => {
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Checkout',
        uses: 'actions/checkout@v4',
        with: { fetchDepth: 0 },
      },
    ],
  });
  const ghAction = serialize(job);
  expect(ghAction.steps).toEqual([
    {
      name: 'Checkout',
      uses: 'actions/checkout@v4',
      with: { fetchDepth: 0 },
    },
  ]);
});

test('step if with Expression<boolean>', () => {
  const ifExpr = eq(github.eventName, 'push');
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Push only',
        run: 'echo push',
        if: ifExpr,
      },
    ],
  });
  const ghAction = serialize(job);
  expect(ghAction.steps[0].if).toBe("github.event_name == 'push'");
});

test('step continueOnError and timeoutMinutes serialization', () => {
  const job = new Job(TestingWorkflow(), 'test', {
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
  const ghAction = serialize(job);
  expect(ghAction.steps[0]['continue-on-error']).toBe(true);
  expect(ghAction.steps[0]['timeout-minutes']).toBe(30);
});

test('mixed RunStep and UsesStep in same job', () => {
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      checkoutV4(),
      { run: 'npm install' },
      { uses: 'actions/setup-node@v4', with: { nodeVersion: '20' } },
      { run: 'npm test', workingDirectory: 'packages/core' },
    ],
  });
  const ghAction = serialize(job);
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

// Type-level: step if accepts Expression<boolean>
const _stepWithExpr: StepConfig = {
  run: 'echo',
  if: expr<boolean>('true'),
};

test('generic matrix strategy serialization', () => {
  const job = new Job(TestingWorkflow(), 'test', {
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
  const ghAction = serialize(job);
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
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      matrix: {
        os: ['ubuntu-latest', 'windows-latest'],
        node: [16, 18],
      } as const,
    },
    steps: [{ run: 'echo hello' }],
  });
  expect(unwrapToken(String(job.matrix.os))).toBe('matrix.os');
  expect(unwrapToken(String(job.matrix.node))).toBe('matrix.node');
});

test('createMatrixProxy produces correct expression strings', () => {
  const proxy = createMatrixProxy({
    os: ['ubuntu-latest', 'windows-latest'],
    version: [1, 2, 3],
  } as const);
  expect(unwrapToken(String(proxy.os))).toBe('matrix.os');
  expect(unwrapToken(String(proxy.version))).toBe('matrix.version');
});

test('failFast serializes as fail-fast', () => {
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    strategy: {
      failFast: true,
    },
    steps: [{ run: 'echo hello' }],
  });
  const ghAction = serialize(job);
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
  const job = new Job(TestingWorkflow(), 'test', {
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
  const ghAction = serialize(job);
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
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'echo hello' }],
    services: {
      redis: {
        image: 'redis:7',
      },
    },
  });
  const ghAction = serialize(job);
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

test('and() composes expressions', () => {
  const isMain = eq(github.ref, 'refs/heads/main');
  const isNotBot = eq(github.actor, 'dependabot[bot]');
  const composed = and(isMain, isNotBot);
  expect(unwrapToken(String(composed))).toBe("(github.ref == 'refs/heads/main' && github.actor == 'dependabot[bot]')");
});

test('job if with Expression<boolean> serializes without ${{ }}', () => {
  const ifExpr = eq(github.ref, 'refs/heads/main');
  const job = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: ifExpr,
    steps: [{ run: 'deploy.sh' }],
  });
  const ghAction = serialize(job);
  expect(ghAction.if).toBe("github.ref == 'refs/heads/main'");
});

test('addDependency with condition: always augments if with always()', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const notify = new Job(TestingWorkflow(), 'notify', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'notify.sh' }],
  });
  notify.addDependency(build, { condition: 'always' });

  const ghAction = serialize(notify);
  expect(ghAction.needs).toEqual(['build']);
  expect(ghAction.if).toBe('always()');
});

test('addDependency with condition: failure augments if with failure()', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const rollback = new Job(TestingWorkflow(), 'rollback', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'rollback.sh' }],
  });
  rollback.addDependency(build, { condition: 'failure' });

  const ghAction = serialize(rollback);
  expect(ghAction.needs).toEqual(['build']);
  expect(ghAction.if).toBe('failure()');
});

test('addDependency with condition: completed augments if with always()', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const cleanup = new Job(TestingWorkflow(), 'cleanup', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'cleanup.sh' }],
  });
  cleanup.addDependency(build, { condition: 'completed' });

  const ghAction = serialize(cleanup);
  expect(ghAction.if).toBe('always()');
});

test('addDependency with condition: success augments if with success()', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const deploy = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'deploy.sh' }],
  });
  deploy.addDependency(build, { condition: 'success' });

  const ghAction = serialize(deploy);
  expect(ghAction.if).toBe('success()');
});

test('addDependency without condition does not set if', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const test = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'test.sh' }],
  });
  test.addDependency(build);

  const ghAction = serialize(test);
  expect(ghAction.needs).toEqual(['build']);
  expect(ghAction.if).toBeUndefined();
});

test('multiple addDependency with conditions composes if with &&', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const test = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'test.sh' }],
  });
  const notify = new Job(TestingWorkflow(), 'notify', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'notify.sh' }],
  });
  notify.addDependency(build, { condition: 'always' });
  notify.addDependency(test, { condition: 'always' });

  const ghAction = serialize(notify);
  expect(ghAction.needs).toEqual(['build', 'test']);
  expect(ghAction.if).toBe('(always() && always())');
});

test('job if from props merges with addDependency condition', () => {
  const build = new Job(TestingWorkflow(), 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [{ run: 'build.sh' }],
  });
  const deploy = new Job(TestingWorkflow(), 'deploy', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    if: eq(github.ref, 'refs/heads/main'),
    steps: [{ run: 'deploy.sh' }],
  });
  deploy.addDependency(build, { condition: 'success' });

  const ghAction = serialize(deploy);
  expect(ghAction.if).toBe("(success() && github.ref == 'refs/heads/main')");
});

test('and() composed with multiple expressions', () => {
  const isMain = eq(github.ref, 'refs/heads/main');
  const combined = and(always(), isMain);
  expect(unwrapToken(String(combined))).toBe("(always() && github.ref == 'refs/heads/main')");
});

test('step if with Expression emits without ${{ }} wrapping', () => {
  const ifExpr = eq(github.eventName, 'push');
  const job = new Job(TestingWorkflow(), 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      {
        name: 'Push only',
        run: 'echo push',
        if: ifExpr,
      },
    ],
  });
  const ghAction = serialize(job);
  expect(ghAction.steps[0].if).toBe("github.event_name == 'push'");
});

test('step() helper returns config with output() method', () => {
  const { step } = require('#src/index.ts');
  const s = step({ id: 'deploy', uses: 'actions/deploy-pages@v4' });
  expect(s.id).toBe('deploy');
  expect(s.uses).toBe('actions/deploy-pages@v4');
  expect(unwrapToken(String(s.output('page_url')))).toBe('steps.deploy.outputs.page_url');
});

test('step() output is non-enumerable', () => {
  const { step } = require('#src/index.ts');
  const s = step({ id: 'build', run: 'npm run build' });
  expect(Object.keys(s)).not.toContain('output');
});

test('step() output serializes correctly in resolveTokens', () => {
  const { step } = require('#src/index.ts');
  const s = step({ id: 'check', uses: 'actions/check@v1' });
  const resolved = resolveTokens({ url: `${s.output('result')}` });
  expect((resolved as any).url).toBe('${{ steps.check.outputs.result }}');
});

// Type-level: JobProps.if accepts Expression<boolean>
const _jobIfExpr: Pick<JobProps, 'if'> = { if: expr<boolean>('true') };

// Type-level: JobProps.if rejects raw string
// @ts-expect-error - raw string should not be assignable to Expression<boolean>
const _jobIfString: Pick<JobProps, 'if'> = { if: 'raw string' };
