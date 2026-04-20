/**
 * Typed expression system for GitHub Actions workflows.
 *
 * Expressions are branded strings at runtime — no AST, no evaluation, no overhead.
 * The phantom type parameter tracks the runtime shape the expression resolves to,
 * enabling type-safe composition at the TypeScript level.
 *
 * Token encoding: expressions embed Unicode noncharacter delimiters (\uFDD0 / \uFDD1)
 * so they are recognizable in any string context. At synthesis time, resolveTokens()
 * walks the serialized output and wraps tokens based on field context:
 *   - `if` fields → raw expression (GitHub Actions auto-evaluates)
 *   - all other fields → `${{ expression }}`
 */

import { camelToSnake } from '#src/utils.ts';

declare const ExpressionBrand: unique symbol;

/**
 * A branded type representing a GitHub Actions expression value.
 * All expression builders return this type; it serializes to a string
 * that can appear in `if:`, `env:`, `with:`, etc.
 *
 * The `T` phantom type tracks the runtime shape the expression resolves to
 * (string, boolean, number, object), enabling operators to be constrained
 * at the type level.
 */
/**
 * Minimal branded type that both `Expression<T>` and `DeepExpression<T>` extend.
 * Used as the parameter type for expression functions — accepts any expression form.
 */
export type AnyExpression<T = unknown> = { readonly [ExpressionBrand]: T };

export type Expression<T = unknown> = string & AnyExpression<T>;

/**
 * A recursive expression type for context proxy nodes.
 * Unlike `Expression<T>`, this does NOT extend `string` — context proxies
 * are not real strings and should not expose `String.prototype` methods.
 *
 * For object-typed `T`, deep property access is supported:
 * `DeepExpression<{ result: string }>` allows `.result` access,
 * returning `DeepExpression<string>`.
 *
 * Both `Expression<T>` and `DeepExpression<T>` share the same brand,
 * so `Expression<T>` is assignable to `DeepExpression<T>` (for leaf types).
 */
export type DeepExpression<T> = AnyExpression<T> &
  (0 extends 1 & T
    ? { readonly [key: string]: any }
    : T extends readonly any[]
      ? {}
      : T extends object
        ? { readonly [K in keyof T]: DeepExpression<T[K]> }
        : {});

const TOKEN_BEGIN = '\uFDD0';
const TOKEN_END = '\uFDD1';
const TOKEN_REGEX = new RegExp(`${TOKEN_BEGIN}([^${TOKEN_END}]*)${TOKEN_END}`, 'g');

const CONTEXT_PROXY_MARKER = Symbol('cdkactions.contextProxy');

/** Extract the raw expression text from a token-delimited string. */
export function unwrapToken(value: string | AnyExpression): string {
  const str = typeof value === 'string' ? value : String(value);
  return str.replaceAll(TOKEN_BEGIN, '').replaceAll(TOKEN_END, '');
}

/** Create an Expression from a raw string, encoded with token delimiters. */
export function expr<T = unknown>(value: string): Expression<T> {
  return `${TOKEN_BEGIN}${value}${TOKEN_END}` as Expression<T>;
}

export function isExpression(value: unknown): value is AnyExpression {
  if (typeof value === 'string') return value.includes(TOKEN_BEGIN);
  if (value !== null && typeof value === 'object' && CONTEXT_PROXY_MARKER in value) return true;
  return false;
}

/**
 * Resolves token-delimited expressions in a serialized object tree.
 * Called at synthesis time when the field context is known.
 *
 *   - `if` fields → strip delimiters, leave raw expression
 *   - all other fields → replace tokens with `${{ expression }}`
 */
export function resolveTokens(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return resolveStringTokens(obj);
  }
  if (isExpression(obj)) {
    return resolveStringTokens(String(obj));
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveTokens(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (key === 'if') {
          if (typeof value === 'string') return [key, unwrapToken(value)];
          if (isExpression(value)) return [key, unwrapToken(String(value))];
          return [key, resolveTokens(value)];
        }
        return [key, resolveTokens(value)];
      }),
    );
  }
  return obj;
}

function resolveStringTokens(value: string): string {
  if (!value.includes(TOKEN_BEGIN)) return value;
  return value.replace(TOKEN_REGEX, (_, e) => `\${{ ${e} }}`);
}

/**
 * Creates a Proxy-based context accessor that returns Expression-typed
 * values for property access. Each property access returns a string of
 * the form `<contextName>.<property>`.
 *
 * When `rename` is true, camelCase property names are converted to
 * snake_case in the output expression (mimicking serde's rename attribute).
 * Dynamic-key contexts (env, secrets, etc.) should pass `false` to
 * preserve the original key.
 */
function createContextProxy<T extends object>(contextName: string, rename = false): T {
  const token = expr(contextName);

  return new Proxy({} as T, {
    get(_target, prop: string | symbol): unknown {
      if (prop === CONTEXT_PROXY_MARKER) return true;
      if (prop === Symbol.toPrimitive) return () => token;
      if (prop === Symbol.iterator) return token[Symbol.iterator].bind(token);
      if (typeof prop === 'symbol') return undefined;

      if (prop in String.prototype || prop === 'length') {
        const val = (token as any)[prop];
        return typeof val === 'function' ? val.bind(token) : val;
      }

      const key = rename ? camelToSnake(prop) : prop;
      return createContextProxy(`${contextName}.${key}`, rename);
    },
    has(_target, prop) {
      if (prop === CONTEXT_PROXY_MARKER) return true;
      return false;
    },
  });
}

export interface GitHubContext {
  readonly action: DeepExpression<string>;
  readonly actionPath: DeepExpression<string>;
  readonly actionRef: DeepExpression<string>;
  readonly actionRepository: DeepExpression<string>;
  readonly actionStatus: DeepExpression<string>;
  readonly actor: DeepExpression<string>;
  readonly actorId: DeepExpression<string>;
  readonly apiUrl: DeepExpression<string>;
  readonly baseRef: DeepExpression<string>;
  readonly event: DeepExpression<Record<string, any>>;
  readonly eventName: DeepExpression<string>;
  readonly graphqlUrl: DeepExpression<string>;
  readonly headRef: DeepExpression<string>;
  readonly job: DeepExpression<string>;
  readonly path: DeepExpression<string>;
  readonly ref: DeepExpression<string>;
  readonly refName: DeepExpression<string>;
  readonly refProtected: DeepExpression<boolean>;
  readonly refType: DeepExpression<'branch' | 'tag'>;
  readonly repository: DeepExpression<string>;
  readonly repositoryId: DeepExpression<string>;
  readonly repositoryOwner: DeepExpression<string>;
  readonly repositoryOwnerId: DeepExpression<string>;
  readonly repositoryUrl: DeepExpression<string>;
  readonly retentionDays: DeepExpression<string>;
  readonly runId: DeepExpression<string>;
  readonly runNumber: DeepExpression<string>;
  readonly runAttempt: DeepExpression<string>;
  readonly secretSource: DeepExpression<string>;
  readonly serverUrl: DeepExpression<string>;
  readonly sha: DeepExpression<string>;
  readonly token: DeepExpression<string>;
  readonly triggeringActor: DeepExpression<string>;
  readonly workflow: DeepExpression<string>;
  readonly workflowRef: DeepExpression<string>;
  readonly workflowSha: DeepExpression<string>;
  readonly workspace: DeepExpression<string>;
}

export interface RunnerContext {
  readonly name: DeepExpression<string>;
  readonly os: DeepExpression<string>;
  readonly arch: DeepExpression<string>;
  readonly temp: DeepExpression<string>;
  readonly toolCache: DeepExpression<string>;
  readonly debug: DeepExpression<string>;
  readonly environment: DeepExpression<string>;
}

export interface EnvContext {
  /** Access an environment variable by name. */
  readonly [key: string]: DeepExpression<string>;
}

export interface SecretsContext {
  readonly GITHUB_TOKEN: DeepExpression<string>;
  /** Access a secret by name. */
  readonly [key: string]: DeepExpression<string>;
}

export interface MatrixContext {
  /** Access a matrix variable by name. */
  readonly [key: string]: DeepExpression<unknown>;
}

export interface NeedsContext {
  /** Access a dependent job's context by job ID. */
  readonly [key: string]: DeepExpression<{
    readonly outputs: Record<string, string>;
    readonly result: string;
  }>;
}

export interface StepsContext {
  /** Access a step's context by step ID. */
  readonly [key: string]: DeepExpression<{
    readonly outputs: Record<string, string>;
    readonly outcome: string;
    readonly conclusion: string;
  }>;
}

export interface InputsContext {
  /** Access a workflow input by name. */
  readonly [key: string]: DeepExpression<string>;
}

export interface VarsContext {
  /** Access a configuration variable by name. */
  readonly [key: string]: DeepExpression<string>;
}

export interface JobContext {
  readonly container: DeepExpression<{
    readonly id: string;
    readonly network: string;
  }>;
  readonly services: DeepExpression<Record<string, { id: string; network: string; ports: Record<string, string> }>>;
  readonly status: DeepExpression<string>;
}

export interface StrategyContext {
  readonly failFast: DeepExpression<boolean>;
  readonly jobIndex: DeepExpression<number>;
  readonly jobTotal: DeepExpression<number>;
  readonly maxParallel: DeepExpression<number>;
}

// --- Event payload types ---
// Describe what github.event contains at runtime for each trigger type.
// All extend Record<string, any> for access to unlisted properties.

export interface PullRequestEventPayload {
  readonly pullRequest: {
    readonly draft: boolean;
    readonly title: string;
    readonly body: string | null;
    readonly number: number;
    readonly merged: boolean;
    readonly head: { readonly ref: string; readonly sha: string };
    readonly base: { readonly ref: string; readonly sha: string };
  };
}

export interface IssueCommentEventPayload {
  readonly comment: { readonly body: string; readonly id: number };
  readonly issue: { readonly title: string; readonly body: string | null; readonly number: number };
}

export interface PullRequestReviewEventPayload {
  readonly review: { readonly body: string | null; readonly state: string };
  readonly pullRequest: PullRequestEventPayload['pullRequest'];
}

export interface PullRequestReviewCommentEventPayload {
  readonly comment: { readonly body: string };
  readonly pullRequest: PullRequestEventPayload['pullRequest'];
}

export interface IssuesEventPayload {
  readonly issue: { readonly title: string; readonly body: string | null; readonly number: number };
}

export interface ReleaseEventPayload {
  readonly release: {
    readonly tagName: string;
    readonly body: string | null;
    readonly name: string | null;
  };
}

export interface WorkflowRunEventPayload {
  readonly workflowRun: {
    readonly conclusion: string | null;
    readonly name: string;
    readonly headBranch: string;
  };
}

export interface PushEventPayload {
  readonly ref: string;
  readonly before: string;
  readonly after: string;
  readonly commits: Array<{ readonly id: string; readonly message: string }>;
}

interface EventPayloadMap {
  pullRequest: PullRequestEventPayload;
  pullRequestTarget: PullRequestEventPayload;
  pullRequestReview: PullRequestReviewEventPayload;
  pullRequestReviewComment: PullRequestReviewCommentEventPayload;
  issueComment: IssueCommentEventPayload;
  issues: IssuesEventPayload;
  release: ReleaseEventPayload;
  workflowRun: WorkflowRunEventPayload;
  push: PushEventPayload;
}

/**
 * Infers the event payload type from the workflow's `on` configuration.
 * Produces a union of matching payload types for multi-event triggers,
 * or Record<string, any> for unmapped events.
 */
export type InferEventPayload<TOn> = TOn extends string | string[]
  ? Record<string, any>
  : TOn extends object
    ? keyof TOn & keyof EventPayloadMap extends never
      ? Record<string, any>
      : EventPayloadMap[keyof TOn & keyof EventPayloadMap]
    : Record<string, any>;

/**
 * A GitHubContext with `event` narrowed based on the workflow's trigger configuration.
 */
export type GitHubContextFor<TOn> = Omit<GitHubContext, 'event'> & {
  readonly event: DeepExpression<InferEventPayload<TOn>>;
};

/** GitHub context — properties of the workflow run and triggering event. */
export const github: GitHubContext = createContextProxy<GitHubContext>('github', true);

/** Runner context — information about the runner executing the job. */
export const runner: RunnerContext = createContextProxy<RunnerContext>('runner', true);

/** Environment variables context. Keys are passed through as-is. */
export const env: EnvContext = createContextProxy<EnvContext>('env');

/** Secrets context. Keys are passed through as-is. */
export const secrets: SecretsContext = createContextProxy<SecretsContext>('secrets');

/** Matrix context — current matrix combination values. Keys are passed through as-is. */
export const matrix: MatrixContext = createContextProxy<MatrixContext>('matrix');

/** Needs context — outputs and results of dependent jobs. Keys are passed through as-is. */
export const needs: NeedsContext = createContextProxy<NeedsContext>('needs');

/** Steps context — outputs and status of previous steps. Keys are passed through as-is. */
export const steps: StepsContext = createContextProxy<StepsContext>('steps');

/** Inputs context — workflow dispatch or reusable workflow inputs. Keys are passed through as-is. */
export const inputs: InputsContext = createContextProxy<InputsContext>('inputs');

/** Configuration variables context. Keys are passed through as-is. */
export const vars: VarsContext = createContextProxy<VarsContext>('vars');

/** Job context — container and services info. */
export const job: JobContext = createContextProxy<JobContext>('job');

/** Strategy context — matrix strategy metadata. */
export const strategy: StrategyContext = createContextProxy<StrategyContext>('strategy', true);

function formatOperand(value: unknown): string {
  if (isExpression(value)) return unwrapToken(value);
  if (typeof value === 'string') return `'${value}'`;
  return String(value);
}

/** Equality: produces `<left> == <right>`. */
export function eq<T>(left: AnyExpression<T>, right: AnyExpression<T> | T): Expression<boolean> {
  return expr(`${unwrapToken(left)} == ${formatOperand(right)}`);
}

/** Inequality: produces `<left> != <right>`. */
export function neq<T>(left: AnyExpression<T>, right: AnyExpression<T> | T): Expression<boolean> {
  return expr(`${unwrapToken(left)} != ${formatOperand(right)}`);
}

/** Greater than: produces `<left> > <right>`. */
export function gt(left: AnyExpression<number>, right: AnyExpression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} > ${formatOperand(right)}`);
}

/** Greater than or equal: produces `<left> >= <right>`. */
export function gte(left: AnyExpression<number>, right: AnyExpression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} >= ${formatOperand(right)}`);
}

/** Less than: produces `<left> < <right>`. */
export function lt(left: AnyExpression<number>, right: AnyExpression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} < ${formatOperand(right)}`);
}

/** Less than or equal: produces `<left> <= <right>`. */
export function lte(left: AnyExpression<number>, right: AnyExpression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} <= ${formatOperand(right)}`);
}

/** Logical negation: produces `!(expr)`. */
export function not(e: AnyExpression<boolean>): Expression<boolean> {
  return expr(`!(${unwrapToken(e)})`);
}

/** Produces `contains(<search>, <item>)`. */
export function contains(
  search: AnyExpression<string> | AnyExpression<string[]>,
  item: string | AnyExpression<string>,
): Expression<boolean> {
  return expr(`contains(${unwrapToken(search)}, ${formatOperand(item)})`);
}

/** Produces `startsWith(<str>, <value>)`. */
export function startsWith(str: AnyExpression<string>, value: string | AnyExpression<string>): Expression<boolean> {
  return expr(`startsWith(${unwrapToken(str)}, ${formatOperand(value)})`);
}

/** Produces `endsWith(<str>, <value>)`. */
export function endsWith(str: AnyExpression<string>, value: string | AnyExpression<string>): Expression<boolean> {
  return expr(`endsWith(${unwrapToken(str)}, ${formatOperand(value)})`);
}

/** Produces `format(<template>, <args...>)`. */
export function format(template: string, ...args: Array<string | AnyExpression>): Expression<string> {
  const allArgs = [`'${template}'`, ...args.map((a) => formatOperand(a))];
  return expr(`format(${allArgs.join(', ')})`);
}

/** Produces `join(<array>, <separator>)`. */
export function join(array: AnyExpression<string[]>, separator?: string): Expression<string> {
  if (separator !== undefined) {
    return expr(`join(${unwrapToken(array)}, '${separator}')`);
  }
  return expr(`join(${unwrapToken(array)})`);
}

/** Produces `toJSON(<value>)`. */
export function toJSON(value: AnyExpression): Expression<string> {
  return expr(`toJSON(${unwrapToken(value)})`);
}

/** Produces `fromJSON(<value>)`. */
export function fromJSON<T = unknown>(value: AnyExpression<string>): Expression<T> {
  return expr(`fromJSON(${unwrapToken(value)})`);
}

/** Produces `hashFiles(<patterns...>)`. */
export function hashFiles(...patterns: string[]): Expression<string> {
  const args = patterns.map((p) => `'${p}'`).join(', ');
  return expr(`hashFiles(${args})`);
}

/** Produces `success()` — true when none of the previous steps have failed or been cancelled. */
export function success(): Expression<boolean> {
  return expr('success()');
}

/** Produces `failure()` — true when any previous step fails. */
export function failure(): Expression<boolean> {
  return expr('failure()');
}

/** Produces `always()` — causes the step to always execute regardless of status. */
export function always(): Expression<boolean> {
  return expr('always()');
}

/** Produces `cancelled()` — true when the workflow was cancelled. */
export function cancelled(): Expression<boolean> {
  return expr('cancelled()');
}

/** Logical AND: produces `(<a> && <b> && ...)`. */
export function and(...exprs: AnyExpression<boolean>[]): Expression<boolean> {
  const parts = exprs.map((e) => unwrapToken(e)).filter((s) => s.trim() !== '');
  if (parts.length === 0) return expr('');
  if (parts.length === 1) return expr(parts[0]);
  return expr(`(${parts.join(' && ')})`);
}

/** Logical OR: produces `(<a> || <b> || ...)`. */
export function or(...exprs: AnyExpression<boolean>[]): Expression<boolean> {
  const parts = exprs.map((e) => unwrapToken(e)).filter((s) => s.trim() !== '');
  if (parts.length === 0) return expr('');
  if (parts.length === 1) return expr(parts[0]);
  return expr(`(${parts.join(' || ')})`);
}

/**
 * Expression namespace — callable as `expression<T>(value)` to create raw expressions,
 * with all operators, status functions, and context proxies as properties.
 *
 * ```typescript
 * import { expression } from '@factbird/cdkactions';
 * const { and, or, eq, github, secrets } = expression;
 * ```
 */
export const expression = Object.assign(expr, {
  and,
  or,
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  not,
  contains,
  startsWith,
  endsWith,
  format,
  join,
  toJSON,
  fromJSON,
  hashFiles,
  success,
  failure,
  always,
  cancelled,
  isExpression,
  github,
  runner,
  env,
  secrets,
  matrix,
  needs,
  steps,
  inputs,
  vars,
  job,
  strategy,
});
