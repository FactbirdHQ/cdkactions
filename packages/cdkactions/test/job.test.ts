import { Job, RunnerLabel } from '#@/index.js';
import type { JobProps, ConcurrencyConfig, EnvironmentConfig, RunnerGroupConfig, Expression } from '#@/index.js';

test('toGHAction', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    continueOnError: true,
    timeoutMinutes: 10,
    strategy: {
      fastFail: true,
      maxParallel: 11,
    },
    steps: [{
      name: 'step',
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
    }],
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
  expect(ghAction.environment).toEqual({ name: 'production', url: 'https://prod.example.com' });
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
    runsOn: { group: 'large-runners', labels: [RunnerLabel.UBUNTU_LATEST, RunnerLabel.custom('gpu')] },
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
const _envObject: EnvironmentConfig = { name: 'staging', url: 'https://staging.example.com' };

// Type-level: ConcurrencyConfig accepts both forms
const _concString: ConcurrencyConfig = 'my-group';
const _concObject: ConcurrencyConfig = { group: 'deploy', cancelInProgress: true };

// Type-level: RunnerGroupConfig
const _runnerGroup: RunnerGroupConfig = { group: 'large', labels: [RunnerLabel.UBUNTU_LATEST] };
