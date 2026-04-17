import {
  // Core type
  type Expression,
  // Context accessors
  github, runner, env, secrets, matrix, needs, steps, inputs, vars, job, strategy,
  // Comparison operators
  eq, neq, gt, gte, lt, lte, not,
  // Built-in functions
  contains, startsWith, endsWith, format, join, toJSON, fromJSON, hashFiles,
  // Status check functions
  success, failure, always, cancelled,
} from '../src';

// ─── Context Accessors ─────────────────────────────────────────────────────────

test('github context returns correct expression strings', () => {
  expect(String(github.ref)).toBe('github.ref');
  expect(String(github.sha)).toBe('github.sha');
  expect(String(github.actor)).toBe('github.actor');
  expect(String(github.repository)).toBe('github.repository');
  expect(String(github.event_name)).toBe('github.event_name');
  expect(String(github.ref_name)).toBe('github.ref_name');
  expect(String(github.run_id)).toBe('github.run_id');
  expect(String(github.token)).toBe('github.token');
  expect(String(github.workspace)).toBe('github.workspace');
});

test('runner context returns correct expression strings', () => {
  expect(String(runner.os)).toBe('runner.os');
  expect(String(runner.arch)).toBe('runner.arch');
  expect(String(runner.temp)).toBe('runner.temp');
  expect(String(runner.name)).toBe('runner.name');
});

test('env context returns correct expression strings', () => {
  expect(String(env.NODE_ENV)).toBe('env.NODE_ENV');
  expect(String(env.CI)).toBe('env.CI');
});

test('secrets context returns correct expression strings', () => {
  expect(String(secrets.GITHUB_TOKEN)).toBe('secrets.GITHUB_TOKEN');
  expect(String(secrets.MY_SECRET)).toBe('secrets.MY_SECRET');
});

test('matrix context returns correct expression strings', () => {
  expect(String(matrix.os)).toBe('matrix.os');
  expect(String(matrix.node)).toBe('matrix.node');
});

test('needs context returns correct expression strings', () => {
  expect(String(needs.build)).toBe('needs.build');
  expect(String(needs.test)).toBe('needs.test');
});

test('steps context returns correct expression strings', () => {
  expect(String(steps.checkout)).toBe('steps.checkout');
  expect(String(steps.build)).toBe('steps.build');
});

test('inputs context returns correct expression strings', () => {
  expect(String(inputs.environment)).toBe('inputs.environment');
  expect(String(inputs.dryRun)).toBe('inputs.dryRun');
});

test('vars context returns correct expression strings', () => {
  expect(String(vars.DEPLOY_URL)).toBe('vars.DEPLOY_URL');
});

test('job context returns correct expression strings', () => {
  expect(String(job.status)).toBe('job.status');
  expect(String(job.container)).toBe('job.container');
  expect(String(job.services)).toBe('job.services');
});

test('strategy context returns correct expression strings', () => {
  expect(String(strategy.fail_fast)).toBe('strategy.fail_fast');
  expect(String(strategy.job_index)).toBe('strategy.job_index');
  expect(String(strategy.job_total)).toBe('strategy.job_total');
  expect(String(strategy.max_parallel)).toBe('strategy.max_parallel');
});

// ─── Comparison Operators ───────────────────────────────────────────────────────

test('eq produces correct expression', () => {
  expect(String(eq(github.ref, 'refs/heads/main'))).toBe("github.ref == 'refs/heads/main'");
});

test('eq with two expressions', () => {
  expect(String(eq(github.ref, github.base_ref))).toBe('github.ref == github.base_ref');
});

test('neq produces correct expression', () => {
  expect(String(neq(github.actor, 'dependabot[bot]'))).toBe("github.actor != 'dependabot[bot]'");
});

test('gt produces correct expression', () => {
  expect(String(gt(strategy.job_index, 0 as unknown as Expression<number>))).toBe('strategy.job_index > 0');
});

test('gte produces correct expression', () => {
  expect(String(gte(strategy.job_total, 2 as unknown as Expression<number>))).toBe('strategy.job_total >= 2');
});

test('lt produces correct expression', () => {
  expect(String(lt(strategy.job_index, strategy.job_total))).toBe('strategy.job_index < strategy.job_total');
});

test('lte produces correct expression', () => {
  expect(String(lte(strategy.max_parallel, 4 as unknown as Expression<number>))).toBe('strategy.max_parallel <= 4');
});

test('not produces correct expression', () => {
  expect(String(not(github.ref_protected))).toBe('!github.ref_protected');
});

// ─── Built-in Functions ─────────────────────────────────────────────────────────

test('contains produces correct expression', () => {
  expect(String(contains(github.event_name, 'pull_request'))).toBe("contains(github.event_name, 'pull_request')");
});

test('startsWith produces correct expression', () => {
  expect(String(startsWith(github.ref, 'refs/tags/'))).toBe("startsWith(github.ref, 'refs/tags/')");
});

test('endsWith produces correct expression', () => {
  expect(String(endsWith(github.ref, '-beta'))).toBe("endsWith(github.ref, '-beta')");
});

test('format produces correct expression', () => {
  expect(String(format('Hello {0}, {1}!', github.actor, 'world'))).toBe("format('Hello {0}, {1}!', github.actor, 'world')");
});

test('join produces correct expression without separator', () => {
  const arr = matrix.os as unknown as Expression<string[]>;
  expect(String(join(arr))).toBe('join(matrix.os)');
});

test('join produces correct expression with separator', () => {
  const arr = matrix.os as unknown as Expression<string[]>;
  expect(String(join(arr, ', '))).toBe("join(matrix.os, ', ')");
});

test('toJSON produces correct expression', () => {
  expect(String(toJSON(github.event))).toBe('toJSON(github.event)');
});

test('fromJSON produces correct expression', () => {
  const jsonExpr = toJSON(github.event);
  expect(String(fromJSON(jsonExpr))).toBe('fromJSON(toJSON(github.event))');
});

test('hashFiles produces correct expression', () => {
  expect(String(hashFiles('**/package-lock.json'))).toBe("hashFiles('**/package-lock.json')");
});

test('hashFiles with multiple patterns', () => {
  expect(String(hashFiles('**/package-lock.json', '**/yarn.lock'))).toBe("hashFiles('**/package-lock.json', '**/yarn.lock')");
});

// ─── Status Check Functions ─────────────────────────────────────────────────────

test('success produces correct expression', () => {
  expect(String(success())).toBe('success()');
});

test('failure produces correct expression', () => {
  expect(String(failure())).toBe('failure()');
});

test('always produces correct expression', () => {
  expect(String(always())).toBe('always()');
});

test('cancelled produces correct expression', () => {
  expect(String(cancelled())).toBe('cancelled()');
});

// ─── Composition ────────────────────────────────────────────────────────────────

test('expressions compose correctly', () => {
  const isMain = eq(github.ref, 'refs/heads/main');
  const isNotBot = neq(github.actor, 'dependabot[bot]');
  // Expressions are just strings, so composition is string concatenation
  expect(String(isMain)).toBe("github.ref == 'refs/heads/main'");
  expect(String(isNotBot)).toBe("github.actor != 'dependabot[bot]'");
});

// ─── Type-Level Tests ───────────────────────────────────────────────────────────
// These verify type constraints at compile time.

// Expression<string> context properties are typed correctly
const _refType: Expression<string> = github.ref;
const _osType: Expression<string> = runner.os;
const _boolType: Expression<boolean> = github.ref_protected;
const _numType: Expression<number> = strategy.job_index;

// Status check functions return Expression<boolean>
const _successType: Expression<boolean> = success();
const _failureType: Expression<boolean> = failure();

// eq returns Expression<boolean>
const _eqType: Expression<boolean> = eq(github.ref, 'main');

// not accepts and returns Expression<boolean>
const _notType: Expression<boolean> = not(github.ref_protected);

// Suppress unused variable warnings
void _refType;
void _osType;
void _boolType;
void _numType;
void _successType;
void _failureType;
void _eqType;
void _notType;
