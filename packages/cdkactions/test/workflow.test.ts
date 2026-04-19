import { Construct } from 'constructs';
import type {
  BranchProtectionRuleTypes,
  CheckSuiteTypes,
  DiscussionCommentTypes,
  DiscussionTypes,
  Expression,
  IssuesTypes,
  Permissions,
  PermissionsMap,
  PullRequestTargetTypes,
  PullRequestTypes,
  ScheduleEntry,
  WorkflowCallEventProps,
  WorkflowCallOutputProps,
  WorkflowCallSecretProps,
  WorkflowProps,
} from '#src/index.ts';
import { Job, RunnerLabel, WorkflowDispatchInputType } from '#src/index.ts';
import { TestingWorkflow } from '#test/utils.ts';

test('toGHAction', () => {
  const workflow = TestingWorkflow({
    name: 'Test',
    on: {
      pullRequest: {
        types: ['opened'],
        paths: ['test/'],
        pathsIgnore: ['ignore-path/'],
      },
      issueComment: { types: ['created'] },
    },
    defaults: {
      run: {
        workingDirectory: '~/',
      },
    },
  });
  expect(workflow.toGHAction()).toMatchSnapshot();
});

test('on: string snake conversion', () => {
  const workflow = TestingWorkflow();
  expect(workflow.toGHAction().on).toBe('pull_request');
});

test('on: string[] snake conversion', () => {
  const workflow = TestingWorkflow({
    on: ['pullRequest', 'push', 'issueComment'],
  });
  const expected = ['pull_request', 'push', 'issue_comment'];
  expect(workflow.toGHAction().on).toEqual(expected);
});

test('2 jobs with same key -> error', () => {
  const workflow = TestingWorkflow();
  new Job(workflow, 'job', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
  });
  expect(
    () =>
      new Job(workflow, 'job', {
        runsOn: RunnerLabel.UBUNTU_LATEST,
        steps: [],
      }),
  ).toThrow("There is already a Construct with name 'job' in Workflow [test]");
});

test('jobs kept in insertion order', () => {
  const workflow = TestingWorkflow();
  const job_one = 'job_one';
  const job_two = 'job_two';
  const job_three = 'job_three';
  new Job(workflow, job_one, {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
  });
  new Job(workflow, job_two, {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
  });
  new Job(workflow, job_three, {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [],
  });
  const jobs = Object.keys(workflow.toGHAction().jobs);
  const expected = [job_one, job_two, job_three];
  expect(jobs).toEqual(expected);
});

test('non-job children are ignored', () => {
  const workflow = TestingWorkflow();
  new Construct(workflow, 'not_job');
  expect(workflow.toGHAction().jobs).toEqual({});
});

test('manual workflow dispatch', () => {
  const workflow = TestingWorkflow({
    name: 'Test',
    on: {
      workflowDispatch: {
        inputs: {
          one: {
            default: 'foo',
            description: 'input one',
            required: false,
            type: WorkflowDispatchInputType.STRING,
          },
        },
      },
    },
  });
  expect(workflow.toGHAction()).toMatchSnapshot();
});

test('branch_protection_rule event', () => {
  const workflow = TestingWorkflow({
    on: {
      branchProtectionRule: { types: ['created', 'edited', 'deleted'] },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on).toEqual({
    branch_protection_rule: { types: ['created', 'edited', 'deleted'] },
  });
});

test('discussion event with all 13 activity types', () => {
  const workflow = TestingWorkflow({
    on: {
      discussion: {
        types: [
          'created',
          'edited',
          'deleted',
          'transferred',
          'pinned',
          'unpinned',
          'labeled',
          'unlabeled',
          'locked',
          'unlocked',
          'category_changed',
          'answered',
          'unanswered',
        ],
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.discussion.types).toHaveLength(13);
  expect(ghAction.on.discussion.types).toContain('category_changed');
});

test('discussion_comment event', () => {
  const workflow = TestingWorkflow({
    on: {
      discussionComment: { types: ['created', 'edited', 'deleted'] },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on).toEqual({
    discussion_comment: { types: ['created', 'edited', 'deleted'] },
  });
});

test('pull_request new activity types', () => {
  const workflow = TestingWorkflow({
    on: {
      pullRequest: {
        types: ['enqueued', 'dequeued', 'milestoned', 'demilestoned', 'auto_merge_enabled', 'auto_merge_disabled'],
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.pull_request.types).toEqual([
    'enqueued',
    'dequeued',
    'milestoned',
    'demilestoned',
    'auto_merge_enabled',
    'auto_merge_disabled',
  ]);
});

test('pull_request_target new activity types', () => {
  const workflow = TestingWorkflow({
    on: {
      pullRequestTarget: {
        types: [
          'converted_to_draft',
          'enqueued',
          'dequeued',
          'milestoned',
          'demilestoned',
          'auto_merge_enabled',
          'auto_merge_disabled',
        ],
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.pull_request_target.types).toEqual([
    'converted_to_draft',
    'enqueued',
    'dequeued',
    'milestoned',
    'demilestoned',
    'auto_merge_enabled',
    'auto_merge_disabled',
  ]);
});

test('check_suite only allows completed', () => {
  const workflow = TestingWorkflow({
    on: {
      checkSuite: { types: ['completed'] },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.check_suite.types).toEqual(['completed']);
});

test('workflow_run includes in_progress type', () => {
  const workflow = TestingWorkflow({
    on: {
      workflowRun: {
        workflows: ['CI'],
        types: ['completed', 'requested', 'in_progress'],
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.workflow_run.types).toEqual(['completed', 'requested', 'in_progress']);
});

test('issues includes typed and untyped activity types', () => {
  const workflow = TestingWorkflow({
    on: {
      issues: {
        types: ['opened', 'typed', 'untyped'],
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.issues.types).toEqual(['opened', 'typed', 'untyped']);
});

// Type-level tests: verify CheckSuiteTypes only accepts 'completed'
// @ts-expect-error - CheckSuiteTypes should not accept 'created'
const _invalidCheckSuite: CheckSuiteTypes = { types: ['created'] };

// Type-level tests: verify new events exist on EventMap
const _branchProtection: BranchProtectionRuleTypes = { types: ['created'] };
const _discussion: DiscussionTypes = { types: ['created', 'answered'] };
const _discussionComment: DiscussionCommentTypes = { types: ['created'] };

test('schedule with multiple entries and timezone', () => {
  const workflow = TestingWorkflow({
    on: {
      schedule: [
        { cron: '0 0 * * *' },
        { cron: '0 12 * * 1-5', timezone: 'America/New_York' },
        { cron: '30 6 * * 0', timezone: 'Europe/Copenhagen' },
      ],
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.schedule).toEqual([
    { cron: '0 0 * * *' },
    { cron: '0 12 * * 1-5', timezone: 'America/New_York' },
    { cron: '30 6 * * 0', timezone: 'Europe/Copenhagen' },
  ]);
});

test('workflow_dispatch with number input type', () => {
  const workflow = TestingWorkflow({
    on: {
      workflowDispatch: {
        inputs: {
          retries: {
            description: 'Number of retries',
            required: true,
            type: WorkflowDispatchInputType.NUMBER,
            default: '3',
          },
        },
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.workflow_dispatch.inputs.retries.type).toBe('number');
});

test('workflow_call with outputs and secrets', () => {
  const workflow = TestingWorkflow({
    on: {
      workflowCall: {
        inputs: {
          environment: {
            description: 'Target environment',
            required: true,
            type: WorkflowDispatchInputType.STRING,
          },
          count: {
            description: 'Instance count',
            required: false,
            type: WorkflowDispatchInputType.NUMBER,
          },
        },
        outputs: {
          deployUrl: {
            description: 'The deployment URL',
            value: '${{ jobs.deploy.outputs.url }}',
          },
        },
        secrets: {
          apiKey: {
            description: 'API key for deployment',
            required: true,
          },
          optionalToken: {
            required: false,
          },
        },
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.workflow_call.inputs.environment.type).toBe('string');
  expect(ghAction.on.workflow_call.inputs.count.type).toBe('number');
  expect(ghAction.on.workflow_call.outputs.deployUrl).toEqual({
    description: 'The deployment URL',
    value: '${{ jobs.deploy.outputs.url }}',
  });
  expect(ghAction.on.workflow_call.secrets.apiKey).toEqual({
    description: 'API key for deployment',
    required: true,
  });
  expect(ghAction.on.workflow_call.secrets.optionalToken).toEqual({
    required: false,
  });
});

test('run-name in synthesized output', () => {
  const workflow = TestingWorkflow({
    runName: 'Deploy to production',
    on: 'push',
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction['run-name']).toBe('Deploy to production');
  expect(ghAction.runName).toBeUndefined();
});

test('run-name with Expression<string>', () => {
  const exprRunName = 'Deploy ${{ inputs.environment }} by ${{ github.actor }}' as Expression<string>;
  const workflow = TestingWorkflow({
    runName: exprRunName,
    on: 'push',
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction['run-name']).toBe('Deploy ${{ inputs.environment }} by ${{ github.actor }}');
});

// Type-level: WorkflowCallEventProps accepts outputs and secrets
const _callWithOutputs: WorkflowCallEventProps = {
  outputs: { url: { description: 'URL', value: 'val' } },
  secrets: { key: { required: true } },
};

// Type-level: ScheduleEntry accepts timezone
const _scheduleWithTz: ScheduleEntry = { cron: '0 0 * * *', timezone: 'UTC' };

// Type-level: runName accepts Expression<string>
const _propsWithRunName: Pick<WorkflowProps, 'runName'> = {
  runName: 'test' as Expression<string>,
};

test('workflow permissions with all 16 scopes', () => {
  const workflow = TestingWorkflow({
    on: 'push',
    permissions: {
      actions: 'read',
      artifactMetadata: 'read',
      attestations: 'write',
      checks: 'write',
      contents: 'read',
      deployments: 'none',
      discussions: 'read',
      idToken: 'write',
      issues: 'write',
      models: 'read',
      packages: 'read',
      pages: 'write',
      pullRequests: 'read',
      repositoryProjects: 'none',
      securityEvents: 'read',
      statuses: 'write',
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.permissions).toEqual({
    actions: 'read',
    'artifact-metadata': 'read',
    attestations: 'write',
    checks: 'write',
    contents: 'read',
    deployments: 'none',
    discussions: 'read',
    'id-token': 'write',
    issues: 'write',
    models: 'read',
    packages: 'read',
    pages: 'write',
    'pull-requests': 'read',
    'repository-projects': 'none',
    'security-events': 'read',
    statuses: 'write',
  });
});

test('workflow permissions read-all shorthand', () => {
  const workflow = TestingWorkflow({
    on: 'push',
    permissions: 'read-all',
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.permissions).toBe('read-all');
});

test('workflow permissions write-all shorthand', () => {
  const workflow = TestingWorkflow({
    on: 'push',
    permissions: 'write-all',
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.permissions).toBe('write-all');
});

// Type-level: idToken only accepts 'write' | 'none'
// @ts-expect-error - idToken does not accept 'read'
const _invalidIdToken: PermissionsMap = { idToken: 'read' };

// Type-level: models only accepts 'read' | 'none'
// @ts-expect-error - models does not accept 'write'
const _invalidModels: PermissionsMap = { models: 'write' };

// Type-level: Permissions accepts PermissionsMap or shorthand strings
const _readAll: Permissions = 'read-all';
const _writeAll: Permissions = 'write-all';
const _mapPerms: Permissions = { contents: 'read' };

test('workflow concurrency string form', () => {
  const workflow = TestingWorkflow({
    on: 'push',
    concurrency: 'deploy-group',
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.concurrency).toBe('deploy-group');
});

test('workflow concurrency object with cancelInProgress', () => {
  const workflow = TestingWorkflow({
    on: 'push',
    concurrency: { group: 'ci-${{ github.ref }}', cancelInProgress: true },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.concurrency).toEqual({
    group: 'ci-${{ github.ref }}',
    'cancel-in-progress': true,
  });
});
