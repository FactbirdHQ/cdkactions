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
export type Expression<T = unknown> = string & {
  readonly [ExpressionBrand]: T;
};

const TOKEN_BEGIN = '\uFDD0';
const TOKEN_END = '\uFDD1';
const TOKEN_REGEX = new RegExp(`${TOKEN_BEGIN}([^${TOKEN_END}]*)${TOKEN_END}`, 'g');

/** Extract the raw expression text from a token-delimited string. */
export function unwrapToken(value: string): string {
  return value.replaceAll(TOKEN_BEGIN, '').replaceAll(TOKEN_END, '');
}

/** Create an Expression from a raw string, encoded with token delimiters. */
export function expr<T = unknown>(value: string): Expression<T> {
  return `${TOKEN_BEGIN}${value}${TOKEN_END}` as Expression<T>;
}

export function isExpression(value: unknown): value is Expression {
  return typeof value === 'string' && value.includes(TOKEN_BEGIN);
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
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveTokens(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (key === 'if') {
          return [key, typeof value === 'string' ? unwrapToken(value) : resolveTokens(value)];
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
  return new Proxy({} as T, {
    get(_target, prop: string) {
      const key = rename ? camelToSnake(prop) : prop;
      return expr(`${contextName}.${key}`);
    },
  });
}

export interface GitHubContext {
  readonly action: Expression<string>;
  readonly actionPath: Expression<string>;
  readonly actionRef: Expression<string>;
  readonly actionRepository: Expression<string>;
  readonly actionStatus: Expression<string>;
  readonly actor: Expression<string>;
  readonly actorId: Expression<string>;
  readonly apiUrl: Expression<string>;
  readonly baseRef: Expression<string>;
  readonly event: Expression<object>;
  readonly eventName: Expression<string>;
  readonly graphqlUrl: Expression<string>;
  readonly headRef: Expression<string>;
  readonly job: Expression<string>;
  readonly path: Expression<string>;
  readonly ref: Expression<string>;
  readonly refName: Expression<string>;
  readonly refProtected: Expression<boolean>;
  readonly refType: Expression<'branch' | 'tag'>;
  readonly repository: Expression<string>;
  readonly repositoryId: Expression<string>;
  readonly repositoryOwner: Expression<string>;
  readonly repositoryOwnerId: Expression<string>;
  readonly repositoryUrl: Expression<string>;
  readonly retentionDays: Expression<string>;
  readonly runId: Expression<string>;
  readonly runNumber: Expression<string>;
  readonly runAttempt: Expression<string>;
  readonly secretSource: Expression<string>;
  readonly serverUrl: Expression<string>;
  readonly sha: Expression<string>;
  readonly token: Expression<string>;
  readonly triggeringActor: Expression<string>;
  readonly workflow: Expression<string>;
  readonly workflowRef: Expression<string>;
  readonly workflowSha: Expression<string>;
  readonly workspace: Expression<string>;
}

export interface RunnerContext {
  readonly name: Expression<string>;
  readonly os: Expression<string>;
  readonly arch: Expression<string>;
  readonly temp: Expression<string>;
  readonly toolCache: Expression<string>;
  readonly debug: Expression<string>;
  readonly environment: Expression<string>;
}

export interface EnvContext {
  /** Access an environment variable by name. */
  readonly [key: string]: Expression<string>;
}

export interface SecretsContext {
  readonly GITHUB_TOKEN: Expression<string>;
  /** Access a secret by name. */
  readonly [key: string]: Expression<string>;
}

export interface MatrixContext {
  /** Access a matrix variable by name. */
  readonly [key: string]: Expression<unknown>;
}

export interface NeedsContext {
  /** Access a dependent job's context by job ID. */
  readonly [key: string]: Expression<{
    readonly outputs: Record<string, string>;
    readonly result: string;
  }>;
}

export interface StepsContext {
  /** Access a step's context by step ID. */
  readonly [key: string]: Expression<{
    readonly outputs: Record<string, string>;
    readonly outcome: string;
    readonly conclusion: string;
  }>;
}

export interface InputsContext {
  /** Access a workflow input by name. */
  readonly [key: string]: Expression<string>;
}

export interface VarsContext {
  /** Access a configuration variable by name. */
  readonly [key: string]: Expression<string>;
}

export interface JobContext {
  readonly container: Expression<{
    readonly id: string;
    readonly network: string;
  }>;
  readonly services: Expression<Record<string, { id: string; network: string; ports: Record<string, string> }>>;
  readonly status: Expression<string>;
}

export interface StrategyContext {
  readonly failFast: Expression<boolean>;
  readonly jobIndex: Expression<number>;
  readonly jobTotal: Expression<number>;
  readonly maxParallel: Expression<number>;
}

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
export function eq<T>(left: Expression<T>, right: Expression<T> | T): Expression<boolean> {
  return expr(`${unwrapToken(left)} == ${formatOperand(right)}`);
}

/** Inequality: produces `<left> != <right>`. */
export function neq<T>(left: Expression<T>, right: Expression<T> | T): Expression<boolean> {
  return expr(`${unwrapToken(left)} != ${formatOperand(right)}`);
}

/** Greater than: produces `<left> > <right>`. */
export function gt(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} > ${formatOperand(right)}`);
}

/** Greater than or equal: produces `<left> >= <right>`. */
export function gte(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} >= ${formatOperand(right)}`);
}

/** Less than: produces `<left> < <right>`. */
export function lt(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} < ${formatOperand(right)}`);
}

/** Less than or equal: produces `<left> <= <right>`. */
export function lte(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${unwrapToken(left)} <= ${formatOperand(right)}`);
}

/** Logical negation: produces `!<expr>`. */
export function not(e: Expression<boolean>): Expression<boolean> {
  return expr(`!(${unwrapToken(e)})`);
}

/** Produces `contains(<search>, <item>)`. */
export function contains(
  search: Expression<string> | Expression<string[]>,
  item: string | Expression<string>,
): Expression<boolean> {
  return expr(`contains(${unwrapToken(search)}, ${formatOperand(item)})`);
}

/** Produces `startsWith(<str>, <value>)`. */
export function startsWith(str: Expression<string>, value: string | Expression<string>): Expression<boolean> {
  return expr(`startsWith(${unwrapToken(str)}, ${formatOperand(value)})`);
}

/** Produces `endsWith(<str>, <value>)`. */
export function endsWith(str: Expression<string>, value: string | Expression<string>): Expression<boolean> {
  return expr(`endsWith(${unwrapToken(str)}, ${formatOperand(value)})`);
}

/** Produces `format(<template>, <args...>)`. */
export function format(template: string, ...args: Array<string | Expression>): Expression<string> {
  const allArgs = [`'${template}'`, ...args.map((a) => formatOperand(a))];
  return expr(`format(${allArgs.join(', ')})`);
}

/** Produces `join(<array>, <separator>)`. */
export function join(array: Expression<string[]>, separator?: string): Expression<string> {
  if (separator !== undefined) {
    return expr(`join(${unwrapToken(array)}, '${separator}')`);
  }
  return expr(`join(${unwrapToken(array)})`);
}

/** Produces `toJSON(<value>)`. */
export function toJSON(value: Expression): Expression<string> {
  return expr(`toJSON(${unwrapToken(value)})`);
}

/** Produces `fromJSON(<value>)`. */
export function fromJSON<T = unknown>(value: Expression<string>): Expression<T> {
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
export function and(...exprs: Expression<boolean>[]): Expression<boolean> {
  const parts = exprs.map((e) => unwrapToken(e)).filter((s) => s.trim() !== '');
  if (parts.length === 0) return expr('');
  if (parts.length === 1) return expr(parts[0]);
  return expr(`(${parts.join(' && ')})`);
}

/** Logical OR: produces `(<a> || <b> || ...)`. */
export function or(...exprs: Expression<boolean>[]): Expression<boolean> {
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
