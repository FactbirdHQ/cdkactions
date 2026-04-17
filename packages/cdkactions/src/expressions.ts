/**
 * Typed expression system for GitHub Actions workflows.
 *
 * Expressions are branded strings at runtime — no AST, no evaluation, no overhead.
 * The phantom type parameter tracks the runtime shape the expression resolves to,
 * enabling type-safe composition at the TypeScript level.
 */

// ─── Core Expression Type ──────────────────────────────────────────────────────

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

/**
 * Create an Expression from a raw string. Internal use only.
 */
function expr<T = unknown>(value: string): Expression<T> {
  return value as Expression<T>;
}

// ─── Context Accessor Factory ───────────────────────────────────────────────────

/**
 * Creates a Proxy-based context accessor that returns Expression-typed
 * values for property access. Each property access returns a string of
 * the form `<contextName>.<property>`.
 *
 * At build time the Proxy returns the string; TypeScript sees the interface.
 */
function createContextProxy<T extends object>(contextName: string): T {
  return new Proxy({} as T, {
    get(_target, prop: string) {
      return expr(`${contextName}.${prop}`);
    },
  });
}

// ─── Context Interfaces ─────────────────────────────────────────────────────────

export interface GitHubContext {
  readonly action: Expression<string>;
  readonly action_path: Expression<string>;
  readonly action_ref: Expression<string>;
  readonly action_repository: Expression<string>;
  readonly action_status: Expression<string>;
  readonly actor: Expression<string>;
  readonly actor_id: Expression<string>;
  readonly api_url: Expression<string>;
  readonly base_ref: Expression<string>;
  readonly event: Expression<object>;
  readonly event_name: Expression<string>;
  readonly graphql_url: Expression<string>;
  readonly head_ref: Expression<string>;
  readonly job: Expression<string>;
  readonly path: Expression<string>;
  readonly ref: Expression<string>;
  readonly ref_name: Expression<string>;
  readonly ref_protected: Expression<boolean>;
  readonly ref_type: Expression<'branch' | 'tag'>;
  readonly repository: Expression<string>;
  readonly repository_id: Expression<string>;
  readonly repository_owner: Expression<string>;
  readonly repository_owner_id: Expression<string>;
  readonly repositoryUrl: Expression<string>;
  readonly retention_days: Expression<string>;
  readonly run_id: Expression<string>;
  readonly run_number: Expression<string>;
  readonly run_attempt: Expression<string>;
  readonly secret_source: Expression<string>;
  readonly server_url: Expression<string>;
  readonly sha: Expression<string>;
  readonly token: Expression<string>;
  readonly triggering_actor: Expression<string>;
  readonly workflow: Expression<string>;
  readonly workflow_ref: Expression<string>;
  readonly workflow_sha: Expression<string>;
  readonly workspace: Expression<string>;
}

export interface RunnerContext {
  readonly name: Expression<string>;
  readonly os: Expression<string>;
  readonly arch: Expression<string>;
  readonly temp: Expression<string>;
  readonly tool_cache: Expression<string>;
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
  readonly [key: string]: Expression<unknown>;
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
  readonly fail_fast: Expression<boolean>;
  readonly job_index: Expression<number>;
  readonly job_total: Expression<number>;
  readonly max_parallel: Expression<number>;
}

// ─── Context Instances ──────────────────────────────────────────────────────────

/** GitHub context — properties of the workflow run and triggering event. */
export const github: GitHubContext = createContextProxy<GitHubContext>('github');

/** Runner context — information about the runner executing the job. */
export const runner: RunnerContext = createContextProxy<RunnerContext>('runner');

/** Environment variables context. */
export const env: EnvContext = createContextProxy<EnvContext>('env');

/** Secrets context. */
export const secrets: SecretsContext = createContextProxy<SecretsContext>('secrets');

/** Matrix context — current matrix combination values. */
export const matrix: MatrixContext = createContextProxy<MatrixContext>('matrix');

/** Needs context — outputs and results of dependent jobs. */
export const needs: NeedsContext = createContextProxy<NeedsContext>('needs');

/** Steps context — outputs and status of previous steps. */
export const steps: StepsContext = createContextProxy<StepsContext>('steps');

/** Inputs context — workflow dispatch or reusable workflow inputs. */
export const inputs: InputsContext = createContextProxy<InputsContext>('inputs');

/** Configuration variables context. */
export const vars: VarsContext = createContextProxy<VarsContext>('vars');

/** Job context — container and services info. */
export const job: JobContext = createContextProxy<JobContext>('job');

/** Strategy context — matrix strategy metadata. */
export const strategy: StrategyContext = createContextProxy<StrategyContext>('strategy');

// ─── Comparison Operators ───────────────────────────────────────────────────────

/** Equality: produces `<left> == <right>`. */
export function eq<T>(left: Expression<T>, right: Expression<T> | T): Expression<boolean> {
  const r = typeof right === 'string' ? `'${right}'` : String(right);
  return expr(`${left} == ${r}`);
}

/** Inequality: produces `<left> != <right>`. */
export function neq<T>(left: Expression<T>, right: Expression<T> | T): Expression<boolean> {
  const r = typeof right === 'string' ? `'${right}'` : String(right);
  return expr(`${left} != ${r}`);
}

/** Greater than: produces `<left> > <right>`. */
export function gt(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${left} > ${String(right)}`);
}

/** Greater than or equal: produces `<left> >= <right>`. */
export function gte(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${left} >= ${String(right)}`);
}

/** Less than: produces `<left> < <right>`. */
export function lt(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${left} < ${String(right)}`);
}

/** Less than or equal: produces `<left> <= <right>`. */
export function lte(left: Expression<number>, right: Expression<number> | number): Expression<boolean> {
  return expr(`${left} <= ${String(right)}`);
}

/** Logical negation: produces `!<expr>`. */
export function not(expression: Expression<boolean>): Expression<boolean> {
  return expr(`!${expression}`);
}

// ─── Built-in Functions ─────────────────────────────────────────────────────────

/** Produces `contains(<search>, <item>)`. */
export function contains(
  search: Expression<string> | Expression<string[]>,
  item: string | Expression<string>,
): Expression<boolean> {
  const i = typeof item === 'string' && !(item as string).includes('.') ? `'${item}'` : String(item);
  return expr(`contains(${search}, ${i})`);
}

/** Produces `startsWith(<str>, <value>)`. */
export function startsWith(
  str: Expression<string>,
  value: string | Expression<string>,
): Expression<boolean> {
  const v = typeof value === 'string' && !(value as string).includes('.') ? `'${value}'` : String(value);
  return expr(`startsWith(${str}, ${v})`);
}

/** Produces `endsWith(<str>, <value>)`. */
export function endsWith(
  str: Expression<string>,
  value: string | Expression<string>,
): Expression<boolean> {
  const v = typeof value === 'string' && !(value as string).includes('.') ? `'${value}'` : String(value);
  return expr(`endsWith(${str}, ${v})`);
}

/** Produces `format(<template>, <args...>)`. */
export function format(
  template: string,
  ...args: Array<string | Expression>
): Expression<string> {
  const allArgs = [
    `'${template}'`,
    ...args.map((a) => (typeof a === 'string' && !(a as string).includes('.') ? `'${a}'` : String(a))),
  ];
  return expr(`format(${allArgs.join(', ')})`);
}

/** Produces `join(<array>, <separator>)`. */
export function join(
  array: Expression<string[]>,
  separator?: string,
): Expression<string> {
  if (separator !== undefined) {
    return expr(`join(${array}, '${separator}')`);
  }
  return expr(`join(${array})`);
}

/** Produces `toJSON(<value>)`. */
export function toJSON(value: Expression): Expression<string> {
  return expr(`toJSON(${value})`);
}

/** Produces `fromJSON(<value>)`. */
export function fromJSON<T = unknown>(value: Expression<string>): Expression<T> {
  return expr(`fromJSON(${value})`);
}

/** Produces `hashFiles(<patterns...>)`. */
export function hashFiles(...patterns: string[]): Expression<string> {
  const args = patterns.map((p) => `'${p}'`).join(', ');
  return expr(`hashFiles(${args})`);
}

// ─── Status Check Functions ─────────────────────────────────────────────────────

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
