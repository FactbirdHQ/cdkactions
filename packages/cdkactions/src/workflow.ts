import assert from 'node:assert';

import { Construct, Node } from 'constructs';

import type { Expression } from './expressions.js';
import { Job, type ConcurrencyConfig } from './job.js';
import type { DefaultsProps, StringMap } from './types.js';
import { camelToSnake, renameKeys, type Writable } from './utils.js';

/**
 * Configuration for the BranchProtectionRule event.
 */
export interface BranchProtectionRuleTypes {
  readonly types: Array<'created' | 'edited' | 'deleted'>;
}

/**
 * Configuration for the CheckRun event.
 */
export interface CheckRunTypes {
  readonly types: Array<'created' | 'rerequested' | 'completed' | 'requested_action'>;
}

export interface CheckSuiteTypes {
  readonly types: Array<'completed'>;
}

export interface DiscussionTypes {
  readonly types: Array<
    | 'created'
    | 'edited'
    | 'deleted'
    | 'transferred'
    | 'pinned'
    | 'unpinned'
    | 'labeled'
    | 'unlabeled'
    | 'locked'
    | 'unlocked'
    | 'category_changed'
    | 'answered'
    | 'unanswered'
  >;
}

export interface DiscussionCommentTypes {
  readonly types: Array<'created' | 'edited' | 'deleted'>;
}

export interface IssueCommentTypes {
  readonly types: Array<'created' | 'edited' | 'deleted'>;
}

export interface IssuesTypes {
  readonly types: Array<
    | 'opened'
    | 'edited'
    | 'deleted'
    | 'transferred'
    | 'pinned'
    | 'unpinned'
    | 'closed'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'locked'
    | 'unlocked'
    | 'milestoned'
    | 'demilestoned'
    | 'typed'
    | 'untyped'
  >;
}

export interface LabelTypes {
  readonly types: Array<'created' | 'edited' | 'deleted'>;
}

export interface MilestoneTypes {
  readonly types: Array<'created' | 'closed' | 'opened' | 'edited' | 'deleted'>;
}

export interface ProjectTypes {
  readonly types: Array<'created' | 'updated' | 'closed' | 'reopened' | 'edited' | 'deleted'>;
}

export interface ProjectCardTypes {
  readonly types: Array<'created' | 'moved' | 'converted' | 'edited' | 'deleted'>;
}

export interface ProjectColumnTypes {
  readonly types: Array<'created' | 'updated' | 'moved' | 'deleted'>;
}

export interface PullRequestTypes extends PushTypes {
  readonly types?: Array<
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'opened'
    | 'edited'
    | 'closed'
    | 'reopened'
    | 'synchronize'
    | 'ready_for_review'
    | 'locked'
    | 'unlocked'
    | 'review_requested'
    | 'review_request_removed'
    | 'converted_to_draft'
    | 'enqueued'
    | 'dequeued'
    | 'milestoned'
    | 'demilestoned'
    | 'auto_merge_enabled'
    | 'auto_merge_disabled'
  >;
}

export interface PullRequestReviewTypes {
  readonly types: Array<'submitted' | 'edited' | 'dismissed'>;
}

export interface PullRequestReviewCommentTypes {
  readonly types: Array<'created' | 'edited' | 'deleted'>;
}

export interface PullRequestTargetTypes {
  readonly types: Array<
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'opened'
    | 'edited'
    | 'closed'
    | 'reopened'
    | 'synchronize'
    | 'ready_for_review'
    | 'locked'
    | 'unlocked'
    | 'review_requested'
    | 'review_request_removed'
    | 'converted_to_draft'
    | 'enqueued'
    | 'dequeued'
    | 'milestoned'
    | 'demilestoned'
    | 'auto_merge_enabled'
    | 'auto_merge_disabled'
  >;
}

export interface RegistryPackageTypes {
  readonly types: Array<'published' | 'updated'>;
}

export interface ReleaseTypes {
  readonly types: Array<'published' | 'unpublished' | 'created' | 'edited' | 'deleted' | 'prereleased' | 'released'>;
}

export interface WatchTypes {
  readonly types: Array<'started'>;
}

export interface PushTypes {
  readonly branches?: string[];
  readonly branchesIgnore?: string[];
  readonly tags?: string[];
  readonly tagsIgnore?: string[];
  readonly paths?: string[];
  readonly pathsIgnore?: string[];
}

export interface MergeGroupTypes {
  readonly types?: Array<'checks_requested'>;
}

export interface ScheduleEntry {
  readonly cron: string;
  readonly timezone?: string;
}

export interface ScheduleEvent {
  readonly schedule: ScheduleEntry[];
}

export interface WorkflowRunEvent {
  readonly workflowRun: {
    readonly workflows?: string[];
    readonly branches?: string[];
    readonly branchesIgnore?: string[];
    readonly types?: Array<'completed' | 'requested' | 'in_progress'>;
  };
}

export const WorkflowDispatchInputType = {
  CHOICE: 'choice',
  BOOLEAN: 'boolean',
  ENVIRONMENT: 'environment',
  STRING: 'string',
  NUMBER: 'number',
} as const;

export type WorkflowDispatchInputType = typeof WorkflowDispatchInputType;

export interface WorkflowDispatchEventInputProps {
  readonly default?: string | boolean;
  readonly description?: string;
  readonly required: boolean;
  readonly type: WorkflowDispatchInputType[keyof WorkflowDispatchInputType];
}

export interface WorkflowDispatchEventChoiceInputProps extends WorkflowDispatchEventInputProps {
  readonly type: WorkflowDispatchInputType['CHOICE'];
  readonly options: string[];
}

export interface WorkflowDispatchEventBooleanInputProps extends WorkflowDispatchEventInputProps {
  readonly type: WorkflowDispatchInputType['BOOLEAN'];
}

export interface WorkflowDispatchEventStringInputProps extends WorkflowDispatchEventInputProps {
  readonly type: WorkflowDispatchInputType['STRING'];
}

export interface WorkflowDispatchEventEnvironmentInputProps extends WorkflowDispatchEventInputProps {
  readonly type: WorkflowDispatchInputType['ENVIRONMENT'];
}

export interface WorkflowDispatchEventNumberInputProps extends WorkflowDispatchEventInputProps {
  readonly type: WorkflowDispatchInputType['NUMBER'];
}

export interface WorkflowDispatchEventProps {
  readonly inputs?: Record<
    string,
    | WorkflowDispatchEventChoiceInputProps
    | WorkflowDispatchEventBooleanInputProps
    | WorkflowDispatchEventStringInputProps
    | WorkflowDispatchEventEnvironmentInputProps
    | WorkflowDispatchEventNumberInputProps
  >;
}

export interface WorkflowDispatchEvent {
  readonly workflowDispatch: WorkflowDispatchEventProps | null;
}

export interface MergeGroupEvent {
  readonly mergeGroup: MergeGroupTypes | null;
}

export type WorkflowCallInputProps =
  | WorkflowDispatchEventBooleanInputProps
  | WorkflowDispatchEventStringInputProps
  | WorkflowDispatchEventNumberInputProps;

export interface WorkflowCallSecretProps {
  readonly description?: string;
  readonly required: boolean;
}

export interface WorkflowCallOutputProps {
  readonly description: string;
  readonly value: string;
}

export interface WorkflowCallEventProps {
  readonly inputs?: Record<string, WorkflowCallInputProps>;
  readonly outputs?: Record<string, WorkflowCallOutputProps>;
  readonly secrets?: Record<string, WorkflowCallSecretProps>;
}

export interface WorkflowCallEvent {
  readonly workflowCall: WorkflowCallEventProps | null;
}

export type EventStrings =
  | 'repositoryDispatch'
  | 'create'
  | 'delete'
  | 'deployment'
  | 'deploymentStatus'
  | 'fork'
  | 'gollum'
  | 'pageBuild'
  | 'public'
  | 'status';

export interface EventMap {
  readonly branchProtectionRule?: BranchProtectionRuleTypes;
  readonly checkRun?: CheckRunTypes;
  readonly checkSuite?: CheckSuiteTypes;
  readonly discussion?: DiscussionTypes;
  readonly discussionComment?: DiscussionCommentTypes;
  readonly issueComment?: IssueCommentTypes;
  readonly issues?: IssuesTypes;
  readonly label?: LabelTypes;
  readonly milestone?: MilestoneTypes;
  readonly project?: ProjectTypes;
  readonly projectCard?: ProjectCardTypes;
  readonly projectColumn?: ProjectColumnTypes;
  readonly pullRequest?: PullRequestTypes | null;
  readonly pullRequestReview?: PullRequestReviewTypes;
  readonly pullRequestReviewComment?: PullRequestReviewCommentTypes;
  readonly pullRequestTarget?: PullRequestTargetTypes;
  readonly push?: PushTypes;
  readonly mergeGroup?: MergeGroupTypes | null;
  readonly registryPackage?: RegistryPackageTypes;
  readonly release?: ReleaseTypes;
  readonly watch?: WatchTypes;
  readonly issue_comment?: { types: ('created' | 'deleted')[] };
}

export type Events = keyof EventMap | EventStrings;

export type TokenPermission = 'read' | 'write' | 'none';

export interface PermissionsMap {
  readonly actions?: TokenPermission;
  readonly artifactMetadata?: TokenPermission;
  readonly attestations?: TokenPermission;
  readonly checks?: TokenPermission;
  readonly contents?: TokenPermission;
  readonly deployments?: TokenPermission;
  readonly discussions?: TokenPermission;
  readonly idToken?: 'write' | 'none';
  readonly issues?: TokenPermission;
  readonly models?: 'read' | 'none';
  readonly packages?: TokenPermission;
  readonly pages?: TokenPermission;
  readonly pullRequests?: TokenPermission;
  readonly repositoryProjects?: TokenPermission;
  readonly securityEvents?: TokenPermission;
  readonly statuses?: TokenPermission;
}

export type Permissions = PermissionsMap | 'read-all' | 'write-all';

export interface WorkflowProps {
  readonly name: string;
  readonly runName?: string | Expression<string>;
  readonly on:
    | Events
    | Array<Events>
    | EventMap
    | ScheduleEvent
    | WorkflowRunEvent
    | WorkflowDispatchEvent
    | MergeGroupEvent
    | WorkflowCallEvent;
  readonly env?: StringMap;
  readonly concurrency?: ConcurrencyConfig;
  readonly defaults?: DefaultsProps;
  readonly permissions?: Permissions;
}

function isPushEvent(on: WorkflowProps['on']): on is { push: NonNullable<EventMap['push']> } {
  if (typeof on !== 'object') return false;
  if (!('push' in on)) return false;
  return true;
}

const excessSpaces = /[\s{2,}]/g;
const whiteSeparators = /[\n\t]/g;

export class Workflow extends Construct {
  public readonly outputFile: string;
  private readonly action: Writable<WorkflowProps>;

  public constructor(scope: Construct, id: string, config: WorkflowProps) {
    const sanitizedId = id.replace(excessSpaces, '-').replace(whiteSeparators, '').trim().toLowerCase();
    super(scope, id);
    this.action = config;
    this.outputFile = `cdkactions_${sanitizedId}.yaml`;
  }

  public addDependency(dependee: Workflow) {
    if (Array.isArray(this.action.on)) throw new Error();
    if (typeof this.action.on === 'string') throw new Error();

    this.action.on =
      'workflowRun' in this.action.on
        ? { ...this.action.on, workflowRun: { ...this.action.on.workflowRun } }
        : { workflowRun: { workflows: [] } };

    this.action.on.workflowRun.workflows ||= [];
    this.action.on.workflowRun.workflows.push(dependee.action.name);

    return this;
  }

  public toGHAction(): any {
    if (isPushEvent(this.action.on)) {
      if (this.action.on.push.paths) {
        this.action.on.push.paths.unshift(`.github/workflows/${this.outputFile}`);
      }
    }

    if (typeof this.action.on !== 'string' && 'workflowRun' in this.action.on) {
      assert(this.action.on.workflowRun.workflows?.length, `${this.action.name} must specify workflows it depends on`);
    }

    const workflow = renameKeys(this.action, {
      runName: 'run-name',
      branchesIgnore: 'branches-ignore',
      tagsIgnore: 'tags-ignore',
      pathsIgnore: 'paths-ignore',
      branchProtectionRule: 'branch_protection_rule',
      checkRun: 'check_run',
      checkSuite: 'check_suite',
      discussionComment: 'discussion_comment',
      issueComment: 'issue_comment',
      mergeGroup: 'merge_group',
      projectCard: 'project_card',
      projectColumn: 'project_column',
      pullRequest: 'pull_request',
      pullRequestReview: 'pull_request_review',
      pullRequestReviewComment: 'pull_request_review_comment',
      pullRequestTarget: 'pull_request_target',
      registryPackage: 'registry_package',
      workingDirectory: 'working-directory',
      cancelInProgress: 'cancel-in-progress',
      workflowDispatch: 'workflow_dispatch',
      workflowRun: 'workflow_run',
      workflowCall: 'workflow_call',
      artifactMetadata: 'artifact-metadata',
      securityEvents: 'security-events',
      repositoryProjects: 'repository-projects',
      pullRequests: 'pull-requests',
      idToken: 'id-token',
    });

    if (typeof workflow.on === 'string') {
      workflow.on = camelToSnake(workflow.on);
    }

    if (Array.isArray(workflow.on)) {
      workflow.on = workflow.on.map(camelToSnake);
    }

    const ghaction: any = { ...workflow, jobs: {} };
    for (const child of Node.of(this).children) {
      if (child instanceof Job) {
        ghaction.jobs[child.id] = child.toGHAction();
      }
    }
    return ghaction;
  }
}
