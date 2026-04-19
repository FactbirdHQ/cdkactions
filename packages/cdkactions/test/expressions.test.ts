import {
  always,
  cancelled,
  contains,
  type Expression,
  endsWith,
  env,
  eq,
  failure,
  format,
  fromJSON,
  github,
  gt,
  gte,
  hashFiles,
  inputs,
  job,
  join,
  lt,
  lte,
  matrix,
  needs,
  neq,
  not,
  runner,
  secrets,
  startsWith,
  steps,
  strategy,
  success,
  toJSON,
  unwrapToken,
  vars,
} from '#@/index.js';

/** Strips token delimiters to check the raw expression text. */
function raw(e: Expression): string {
  return unwrapToken(String(e));
}

test('github context returns correct expression strings', () => {
  expect(raw(github.ref)).toBe('github.ref');
  expect(raw(github.sha)).toBe('github.sha');
  expect(raw(github.actor)).toBe('github.actor');
  expect(raw(github.repository)).toBe('github.repository');
  expect(raw(github.eventName)).toBe('github.event_name');
  expect(raw(github.refName)).toBe('github.ref_name');
  expect(raw(github.runId)).toBe('github.run_id');
  expect(raw(github.token)).toBe('github.token');
  expect(raw(github.workspace)).toBe('github.workspace');
});

test('github context camelCase to snake_case conversion', () => {
  expect(raw(github.actionPath)).toBe('github.action_path');
  expect(raw(github.actionRef)).toBe('github.action_ref');
  expect(raw(github.actionRepository)).toBe('github.action_repository');
  expect(raw(github.actorId)).toBe('github.actor_id');
  expect(raw(github.apiUrl)).toBe('github.api_url');
  expect(raw(github.baseRef)).toBe('github.base_ref');
  expect(raw(github.headRef)).toBe('github.head_ref');
  expect(raw(github.repositoryOwner)).toBe('github.repository_owner');
  expect(raw(github.triggeringActor)).toBe('github.triggering_actor');
  expect(raw(github.workflowRef)).toBe('github.workflow_ref');
});

test('runner context returns correct expression strings', () => {
  expect(raw(runner.os)).toBe('runner.os');
  expect(raw(runner.arch)).toBe('runner.arch');
  expect(raw(runner.temp)).toBe('runner.temp');
  expect(raw(runner.name)).toBe('runner.name');
  expect(raw(runner.toolCache)).toBe('runner.tool_cache');
});

test('env context returns correct expression strings', () => {
  expect(raw(env.NODE_ENV)).toBe('env.NODE_ENV');
  expect(raw(env.CI)).toBe('env.CI');
});

test('secrets context returns correct expression strings', () => {
  expect(raw(secrets.GITHUB_TOKEN)).toBe('secrets.GITHUB_TOKEN');
  expect(raw(secrets.MY_SECRET)).toBe('secrets.MY_SECRET');
});

test('matrix context returns correct expression strings', () => {
  expect(raw(matrix.os)).toBe('matrix.os');
  expect(raw(matrix.node)).toBe('matrix.node');
});

test('needs context returns correct expression strings', () => {
  expect(raw(needs.build)).toBe('needs.build');
  expect(raw(needs.test)).toBe('needs.test');
});

test('steps context returns correct expression strings', () => {
  expect(raw(steps.checkout)).toBe('steps.checkout');
  expect(raw(steps.build)).toBe('steps.build');
});

test('inputs context returns correct expression strings', () => {
  expect(raw(inputs.environment)).toBe('inputs.environment');
  expect(raw(inputs.dryRun)).toBe('inputs.dryRun');
});

test('vars context returns correct expression strings', () => {
  expect(raw(vars.DEPLOY_URL)).toBe('vars.DEPLOY_URL');
});

test('job context returns correct expression strings', () => {
  expect(raw(job.status)).toBe('job.status');
  expect(raw(job.container)).toBe('job.container');
  expect(raw(job.services)).toBe('job.services');
});

test('strategy context returns correct expression strings', () => {
  expect(raw(strategy.failFast)).toBe('strategy.fail_fast');
  expect(raw(strategy.jobIndex)).toBe('strategy.job_index');
  expect(raw(strategy.jobTotal)).toBe('strategy.job_total');
  expect(raw(strategy.maxParallel)).toBe('strategy.max_parallel');
});

test('eq produces correct expression', () => {
  expect(raw(eq(github.ref, 'refs/heads/main'))).toBe("github.ref == 'refs/heads/main'");
});

test('eq with two expressions', () => {
  expect(raw(eq(github.ref, github.baseRef))).toBe('github.ref == github.base_ref');
});

test('neq produces correct expression', () => {
  expect(raw(neq(github.actor, 'dependabot[bot]'))).toBe("github.actor != 'dependabot[bot]'");
});

test('gt produces correct expression', () => {
  expect(raw(gt(strategy.jobIndex, 0 as unknown as Expression<number>))).toBe('strategy.job_index > 0');
});

test('gte produces correct expression', () => {
  expect(raw(gte(strategy.jobTotal, 2 as unknown as Expression<number>))).toBe('strategy.job_total >= 2');
});

test('lt produces correct expression', () => {
  expect(raw(lt(strategy.jobIndex, strategy.jobTotal))).toBe('strategy.job_index < strategy.job_total');
});

test('lte produces correct expression', () => {
  expect(raw(lte(strategy.maxParallel, 4 as unknown as Expression<number>))).toBe('strategy.max_parallel <= 4');
});

test('not produces correct expression', () => {
  expect(raw(not(github.refProtected))).toBe('!github.ref_protected');
});

test('contains produces correct expression', () => {
  expect(raw(contains(github.eventName, 'pull_request'))).toBe("contains(github.event_name, 'pull_request')");
});

test('startsWith produces correct expression', () => {
  expect(raw(startsWith(github.ref, 'refs/tags/'))).toBe("startsWith(github.ref, 'refs/tags/')");
});

test('endsWith produces correct expression', () => {
  expect(raw(endsWith(github.ref, '-beta'))).toBe("endsWith(github.ref, '-beta')");
});

test('format produces correct expression', () => {
  expect(raw(format('Hello {0}, {1}!', github.actor, 'world'))).toBe(
    "format('Hello {0}, {1}!', github.actor, 'world')",
  );
});

test('join produces correct expression without separator', () => {
  const arr = matrix.os as unknown as Expression<string[]>;
  expect(raw(join(arr))).toBe('join(matrix.os)');
});

test('join produces correct expression with separator', () => {
  const arr = matrix.os as unknown as Expression<string[]>;
  expect(raw(join(arr, ', '))).toBe("join(matrix.os, ', ')");
});

test('toJSON produces correct expression', () => {
  expect(raw(toJSON(github.event))).toBe('toJSON(github.event)');
});

test('fromJSON produces correct expression', () => {
  const jsonExpr = toJSON(github.event);
  expect(raw(fromJSON(jsonExpr))).toBe('fromJSON(toJSON(github.event))');
});

test('hashFiles produces correct expression', () => {
  expect(raw(hashFiles('**/package-lock.json'))).toBe("hashFiles('**/package-lock.json')");
});

test('hashFiles with multiple patterns', () => {
  expect(raw(hashFiles('**/package-lock.json', '**/yarn.lock'))).toBe(
    "hashFiles('**/package-lock.json', '**/yarn.lock')",
  );
});

test('success produces correct expression', () => {
  expect(raw(success())).toBe('success()');
});

test('failure produces correct expression', () => {
  expect(raw(failure())).toBe('failure()');
});

test('always produces correct expression', () => {
  expect(raw(always())).toBe('always()');
});

test('cancelled produces correct expression', () => {
  expect(raw(cancelled())).toBe('cancelled()');
});

test('expressions compose correctly', () => {
  const isMain = eq(github.ref, 'refs/heads/main');
  const isNotBot = neq(github.actor, 'dependabot[bot]');
  expect(raw(isMain)).toBe("github.ref == 'refs/heads/main'");
  expect(raw(isNotBot)).toBe("github.actor != 'dependabot[bot]'");
});

// Expression<string> context properties are typed correctly
const _refType: Expression<string> = github.ref;
const _osType: Expression<string> = runner.os;
const _boolType: Expression<boolean> = github.refProtected;
const _numType: Expression<number> = strategy.jobIndex;

// Status check functions return Expression<boolean>
const _successType: Expression<boolean> = success();
const _failureType: Expression<boolean> = failure();

// eq returns Expression<boolean>
const _eqType: Expression<boolean> = eq(github.ref, 'main');

// not accepts and returns Expression<boolean>
const _notType: Expression<boolean> = not(github.refProtected);

// Suppress unused variable warnings
void _refType;
void _osType;
void _boolType;
void _numType;
void _successType;
void _failureType;
void _eqType;
void _notType;
