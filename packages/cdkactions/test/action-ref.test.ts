import { ActionRef, Condition, type Expression, type TypedUsesStep } from '#@/index.js';

const allOptionalAction = ActionRef.fromReference<
  {
    repository: { default: '${{ github.repository }}' };
    token: { default: '${{ github.token }}' };
    fetchDepth: { default: '1' };
  },
  {
    ref: {};
    commit: {};
  }
>('actions/all-optional@v1');

const uploadArtifactV4 = ActionRef.fromReference<
  {
    name: { required: true };
    path: { required: true };
    ifNoFilesFound: { default: 'warn' };
    compressionLevel: { default: '6' };
  },
  {
    artifactId: {};
    artifactUrl: {};
  }
>('actions/upload-artifact@v4');

const setupAction = ActionRef.fromReference<
  {
    nodeVersion: {};
    cache: { default: '' };
  },
  {
    cacheHit: {};
  }
>('actions/setup-node@v4');

const emptyAction = ActionRef.fromReference('actions/empty@v1');

const noOutputAction = ActionRef.fromReference<{ inputA: { required: true } }, Record<never, never>>(
  'actions/no-output@v1',
);

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    console.error(`  ✗ ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
  };
}

console.log('ActionRef');

test('fromReference stores the action ref string', () => {
  expect(allOptionalAction.ref).toBe('actions/all-optional@v1');
});

test('fromReference with no type params', () => {
  const action = ActionRef.fromReference('my/action@v1');
  expect(action.ref).toBe('my/action@v1');
});

test('call() produces a step with uses set to the ref', () => {
  const step = allOptionalAction.call({ id: 'co' });
  expect(step.uses).toBe('actions/all-optional@v1');
});

test('call() sets id on the step', () => {
  const step = allOptionalAction.call({ id: 'co' });
  expect(step.id).toBe('co');
});

test('call() sets name when provided', () => {
  const step = allOptionalAction.call({ id: 'co', name: 'Checkout code' });
  expect(step.name).toBe('Checkout code');
});

test('call() sets if when provided', () => {
  const cond = Condition.from('github.ref == refs/heads/main');
  const step = allOptionalAction.call({ id: 'co', if: cond });
  expect(step.if!.toString()).toBe('github.ref == refs/heads/main');
});

test('call() sets env when provided', () => {
  const step = allOptionalAction.call({
    id: 'co',
    env: { NODE_ENV: 'production' },
  });
  expect(step.env).toEqual({ NODE_ENV: 'production' });
});

test('call() sets continueOnError when provided', () => {
  const step = allOptionalAction.call({ id: 'co', continueOnError: true });
  expect(step.continueOnError).toBe(true);
});

test('call() sets timeoutMinutes when provided', () => {
  const step = allOptionalAction.call({ id: 'co', timeoutMinutes: 10 });
  expect(step.timeoutMinutes).toBe(10);
});

test('call() passes optional inputs in with', () => {
  const step = allOptionalAction.call({ id: 'co', with: { fetchDepth: 0 } });
  expect(step.with).toEqual({ 'fetch-depth': 0 });
});

test('call() with required inputs', () => {
  const step = uploadArtifactV4.call({
    id: 'upload',
    with: { name: 'dist', path: 'dist/' },
  });
  expect(step.with).toEqual({ name: 'dist', path: 'dist/' });
  expect(step.uses).toBe('actions/upload-artifact@v4');
});

test('call() with required + optional inputs', () => {
  const step = uploadArtifactV4.call({
    id: 'upload',
    with: { name: 'dist', path: 'dist/', ifNoFilesFound: 'error' },
  });
  expect(step.with).toEqual({
    name: 'dist',
    path: 'dist/',
    'if-no-files-found': 'error',
  });
});

test('call() with bare-required input (no default, no required:true)', () => {
  const step = setupAction.call({ id: 'setup', with: { nodeVersion: '20' } });
  expect(step.with).toEqual({ 'node-version': '20' });
});

test('call() with no inputs and no outputs', () => {
  const step = emptyAction.call({});
  expect(step.uses).toBe('actions/empty@v1');
});

test('call() on no-output action allows omitting id', () => {
  const step = noOutputAction.call({ with: { inputA: 'val' } });
  expect(step.uses).toBe('actions/no-output@v1');
});

test('camelCase input keys are serialized to kebab-case', () => {
  const step = allOptionalAction.call({ id: 'co', with: { fetchDepth: 0 } });
  expect(step.with).toEqual({ 'fetch-depth': 0 });
});

test('multi-word camelCase keys convert correctly', () => {
  const step = uploadArtifactV4.call({
    id: 'upload',
    with: { name: 'dist', path: 'dist/', compressionLevel: '6' },
  });
  expect(step.with).toEqual({
    name: 'dist',
    path: 'dist/',
    'compression-level': '6',
  });
});

test('output() returns expression string for known output key', () => {
  const step = allOptionalAction.call({ id: 'co' });
  const ref = step.output('ref');
  expect(ref as string).toBe('steps.co.outputs.ref');
});

test('output() returns expression for another known output key', () => {
  const step = allOptionalAction.call({ id: 'co' });
  const commit = step.output('commit');
  expect(commit as string).toBe('steps.co.outputs.commit');
});

test('output() on uploadArtifact returns correct expression', () => {
  const step = uploadArtifactV4.call({
    id: 'upload',
    with: { name: 'dist', path: 'dist/' },
  });
  expect(step.output('artifactId') as string).toBe('steps.upload.outputs.artifactId');
  expect(step.output('artifactUrl') as string).toBe('steps.upload.outputs.artifactUrl');
});

console.log('\nType-level tests (compile-time checks):');

const _validStep: TypedUsesStep<{ ref: {}; commit: {} }> = allOptionalAction.call({ id: 'co' });

const _outputRef: Expression<string> = _validStep.output('ref');

// @ts-expect-error — 'nonexistent' is not an output
allOptionalAction.call({ id: 'co' }).output('nonexistent');

// @ts-expect-error — 'branchName' is not a valid input
allOptionalAction.call({ id: 'co', with: { branchName: 'main' } });

// @ts-expect-error — 'name' (required) is missing from upload-artifact with
uploadArtifactV4.call({ id: 'upload', with: { path: 'dist/' } });

// @ts-expect-error — 'path' (required) is missing from upload-artifact with
uploadArtifactV4.call({ id: 'upload', with: { name: 'dist' } });

// @ts-expect-error — 'unknownInput' is not a valid input
uploadArtifactV4.call({
  id: 'upload',
  with: { name: 'dist', path: 'dist/', unknownInput: 'bad' },
});

// @ts-expect-error — 'nodeVersion' (bare required) is missing
setupAction.call({ id: 'setup' });

console.log('  ✓ All @ts-expect-error annotations compile correctly');
