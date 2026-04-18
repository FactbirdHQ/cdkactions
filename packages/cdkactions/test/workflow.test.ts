import { Construct } from 'constructs';
import { Job, WorkflowDispatchInputType } from '../src';
import type {
  BranchProtectionRuleTypes,
  DiscussionTypes,
  DiscussionCommentTypes,
  PullRequestTypes,
  PullRequestTargetTypes,
  CheckSuiteTypes,
  IssuesTypes,
} from '../src';
import { TestingWorkflow } from './utils';

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
    runsOn: 'ubuntu-latest',
    steps: [],
  });
  expect(
    () =>
      new Job(workflow, 'job', {
        runsOn: 'ubuntu-latest',
        steps: [],
      }),
  ).toThrowError("There is already a Construct with name 'job' in Workflow [test]");
});

test('jobs kept in insertion order', () => {
  const workflow = TestingWorkflow();
  const job_one = 'job_one';
  const job_two = 'job_two';
  const job_three = 'job_three';
  new Job(workflow, job_one, {
    runsOn: 'ubuntu-latest',
    steps: [],
  });
  new Job(workflow, job_two, {
    runsOn: 'ubuntu-latest',
    steps: [],
  });
  new Job(workflow, job_three, {
    runsOn: 'ubuntu-latest',
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
          'created', 'edited', 'deleted', 'transferred',
          'pinned', 'unpinned', 'labeled', 'unlabeled',
          'locked', 'unlocked', 'category_changed', 'answered', 'unanswered',
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
    'enqueued', 'dequeued', 'milestoned', 'demilestoned', 'auto_merge_enabled', 'auto_merge_disabled',
  ]);
});

test('pull_request_target new activity types', () => {
  const workflow = TestingWorkflow({
    on: {
      pullRequestTarget: {
        types: ['converted_to_draft', 'enqueued', 'dequeued', 'milestoned', 'demilestoned', 'auto_merge_enabled', 'auto_merge_disabled'],
      },
    },
  });
  const ghAction = workflow.toGHAction();
  expect(ghAction.on.pull_request_target.types).toEqual([
    'converted_to_draft', 'enqueued', 'dequeued', 'milestoned', 'demilestoned', 'auto_merge_enabled', 'auto_merge_disabled',
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
