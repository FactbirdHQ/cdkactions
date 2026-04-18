import { Job } from '#@/index.js';
import type { JobProps } from '#@/index.js';

test('toGHAction', () => {
  const job = new Job(undefined as any, 'test', {
    runsOn: 'ubuntu-latest',
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
    runsOn: 'ubuntu-latest',
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
    runsOn: 'ubuntu-latest',
    steps: [],
    permissions: 'read-all',
  });
  const ghAction = job.toGHAction();
  expect(ghAction.permissions).toBe('read-all');
});

// Type-level: JobProps.permissions accepts Permissions type
const _jobWithPerms: Pick<JobProps, 'permissions'> = {
  permissions: { contents: 'read', idToken: 'write' },
};
const _jobReadAll: Pick<JobProps, 'permissions'> = {
  permissions: 'read-all',
};
