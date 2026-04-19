import { defineAction, Condition, type TypedUsesStep, type Expression } from '#@/index.js';

const allOptionalAction = defineAction<
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

const uploadArtifactV4 = defineAction<
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

const setupAction = defineAction<
  {
    nodeVersion: {};
    cache: { default: '' };
  },
  {
    cacheHit: {};
  }
>('actions/setup-node@v4');

const emptyAction = defineAction('actions/empty@v1');

const noOutputAction = defineAction<{ inputA: { required: true } }, Record<never, never>>(
  'actions/no-output@v1',
);

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    console.error(`  ✗ ${name}: ${(e as Error).message}`);
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

console.log('Action');

test('defineAction stores the action ref string', () => {
  expect(allOptionalAction.ref).toBe('actions/all-optional@v1');
});

test('defineAction stores uses equal to ref', () => {
  expect(allOptionalAction.uses).toBe('actions/all-optional@v1');
});

test('defineAction with no type params', () => {
  const action = defineAction('my/action@v1');
  expect(action.ref).toBe('my/action@v1');
});

test('calling produces a step with uses set to the ref', () => {
  const step = allOptionalAction({ id: 'co' });
  expect(step.uses).toBe('actions/all-optional@v1');
});

test('calling sets id on the step', () => {
  const step = allOptionalAction({ id: 'co' });
  expect(step.id).toBe('co');
});

test('calling sets name when provided', () => {
  const step = allOptionalAction({ id: 'co', name: 'Checkout code' });
  expect(step.name).toBe('Checkout code');
});

test('calling sets if when provided', () => {
  const cond = Condition.from('github.ref == refs/heads/main');
  const step = allOptionalAction({ id: 'co', if: cond });
  expect(step.if!.toString()).toBe('github.ref == refs/heads/main');
});

test('calling sets env when provided', () => {
  const step = allOptionalAction({
    id: 'co',
    env: { NODE_ENV: 'production' },
  });
  expect(step.env).toEqual({ NODE_ENV: 'production' });
});

test('calling sets continueOnError when provided', () => {
  const step = allOptionalAction({ id: 'co', continueOnError: true });
  expect(step.continueOnError).toBe(true);
});

test('calling sets timeoutMinutes when provided', () => {
  const step = allOptionalAction({ id: 'co', timeoutMinutes: 10 });
  expect(step.timeoutMinutes).toBe(10);
});

test('calling passes optional inputs in with', () => {
  const step = allOptionalAction({ id: 'co', with: { fetchDepth: 0 } });
  expect(step.with).toEqual({ 'fetch-depth': 0 });
});

test('calling with required inputs', () => {
  const step = uploadArtifactV4({
    id: 'upload',
    with: { name: 'dist', path: 'dist/' },
  });
  expect(step.with).toEqual({ name: 'dist', path: 'dist/' });
  expect(step.uses).toBe('actions/upload-artifact@v4');
});

test('calling with required + optional inputs', () => {
  const step = uploadArtifactV4({
    id: 'upload',
    with: { name: 'dist', path: 'dist/', ifNoFilesFound: 'error' },
  });
  expect(step.with).toEqual({
    name: 'dist',
    path: 'dist/',
    'if-no-files-found': 'error',
  });
});

test('calling with bare-required input (no default, no required:true)', () => {
  const step = setupAction({ id: 'setup', with: { nodeVersion: '20' } });
  expect(step.with).toEqual({ 'node-version': '20' });
});

test('calling with no inputs and no outputs', () => {
  const step = emptyAction();
  expect(step.uses).toBe('actions/empty@v1');
});

test('calling on no-output action allows omitting id', () => {
  const step = noOutputAction({ with: { inputA: 'val' } });
  expect(step.uses).toBe('actions/no-output@v1');
});

test('calling with no args when all inputs optional', () => {
  const step = allOptionalAction();
  expect(step.uses).toBe('actions/all-optional@v1');
});

test('camelCase input keys are serialized to kebab-case', () => {
  const step = allOptionalAction({ id: 'co', with: { fetchDepth: 0 } });
  expect(step.with).toEqual({ 'fetch-depth': 0 });
});

test('multi-word camelCase keys convert correctly', () => {
  const step = uploadArtifactV4({
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
  const step = allOptionalAction({ id: 'co' });
  const ref = step.output('ref');
  expect(ref as string).toBe('steps.co.outputs.ref');
});

test('output() returns expression for another known output key', () => {
  const step = allOptionalAction({ id: 'co' });
  const commit = step.output('commit');
  expect(commit as string).toBe('steps.co.outputs.commit');
});

test('output() on uploadArtifact returns correct expression', () => {
  const step = uploadArtifactV4({
    id: 'upload',
    with: { name: 'dist', path: 'dist/' },
  });
  expect(step.output('artifactId') as string).toBe('steps.upload.outputs.artifactId');
  expect(step.output('artifactUrl') as string).toBe('steps.upload.outputs.artifactUrl');
});

import {
  checkoutV4,
  setupNodeV6,
  setupGoV6,
  setupJavaV5,
  setupPythonV6,
  setupRubyV1,
  createGithubAppTokenV3,
  githubScriptV9,
  addToProjectV1,
  publishImmutableActionV1,
  uploadReleaseAssetV1,
  createReleaseV1,
  determinateNixV3,
  installNixActionV31,
} from '#@/actions.js';

console.log('\nPre-built action definitions:');

test('checkoutV4 ref is correct', () => {
  expect(checkoutV4.ref).toBe('actions/checkout@v4');
});

test('checkoutV4 can be called with no args', () => {
  const step = checkoutV4();
  expect(step.uses).toBe('actions/checkout@v4');
});

test('setupNodeV6 produces correct uses and serializes inputs', () => {
  const step = setupNodeV6({ id: 'node', with: { nodeVersion: '22' } });
  expect(step.uses).toBe('actions/setup-node@v6');
  expect(step.with).toEqual({ 'node-version': '22' });
});

test('setupNodeV6 output returns expression', () => {
  const step = setupNodeV6({ id: 'node' });
  expect(step.output('cacheHit') as string).toBe('steps.node.outputs.cacheHit');
});

test('setupGoV6 ref is correct', () => {
  expect(setupGoV6.ref).toBe('actions/setup-go@v6');
});

test('setupJavaV5 requires distribution input', () => {
  const step = setupJavaV5({ id: 'java', with: { distribution: 'temurin' } });
  expect(step.uses).toBe('actions/setup-java@v5');
  expect(step.with).toEqual({ distribution: 'temurin' });
});

test('setupPythonV6 ref is correct', () => {
  expect(setupPythonV6.ref).toBe('actions/setup-python@v6');
});

test('setupRubyV1 uses ruby/setup-ruby', () => {
  expect(setupRubyV1.ref).toBe('ruby/setup-ruby@v1');
});

test('createGithubAppTokenV3 requires privateKey', () => {
  const step = createGithubAppTokenV3({ id: 'token', with: { privateKey: '${{ secrets.PK }}' } });
  expect(step.uses).toBe('actions/create-github-app-token@v3');
  expect(step.with).toEqual({ 'private-key': '${{ secrets.PK }}' });
});

test('githubScriptV9 requires script input', () => {
  const step = githubScriptV9({ id: 'script', with: { script: 'console.log("hi")' } });
  expect(step.uses).toBe('actions/github-script@v9');
  expect(step.with).toEqual({ script: 'console.log("hi")' });
});

test('addToProjectV1 requires projectUrl and githubToken', () => {
  const step = addToProjectV1({ id: 'add', with: { projectUrl: 'https://...', githubToken: '${{ secrets.T }}' } });
  expect(step.uses).toBe('actions/add-to-project@v1');
  expect(step.with).toEqual({ 'project-url': 'https://...', 'github-token': '${{ secrets.T }}' });
});

test('publishImmutableActionV1 ref is correct', () => {
  expect(publishImmutableActionV1.ref).toBe('actions/publish-immutable-action@v1');
});

test('uploadReleaseAssetV1 snake_case inputs pass through unchanged', () => {
  const step = uploadReleaseAssetV1({
    id: 'upload',
    with: {
      upload_url: 'https://...',
      asset_path: 'dist.zip',
      asset_name: 'dist.zip',
      asset_content_type: 'application/zip',
    },
  });
  expect(step.with).toEqual({
    upload_url: 'https://...',
    asset_path: 'dist.zip',
    asset_name: 'dist.zip',
    asset_content_type: 'application/zip',
  });
});

test('createReleaseV1 requires tag_name and release_name', () => {
  const step = createReleaseV1({ id: 'release', with: { tag_name: 'v1.0.0', release_name: 'Release 1.0' } });
  expect(step.uses).toBe('actions/create-release@v1');
});

test('determinateNixV3 ref is correct', () => {
  expect(determinateNixV3.ref).toBe('DeterminateSystems/determinate-nix-action@v3');
});

test('installNixActionV31 snake_case inputs pass through unchanged', () => {
  const step = installNixActionV31({ with: { extra_nix_config: 'experimental-features = nix-command flakes' } });
  expect(step.uses).toBe('cachix/install-nix-action@v31');
  expect(step.with).toEqual({ extra_nix_config: 'experimental-features = nix-command flakes' });
});

console.log('\nType-level tests (compile-time checks):');

const _validStep: TypedUsesStep<{ ref: {}; commit: {} }> = allOptionalAction({ id: 'co' });

const _outputRef: Expression<string> = _validStep.output('ref');

// @ts-expect-error — 'nonexistent' is not an output
allOptionalAction({ id: 'co' }).output('nonexistent');

// @ts-expect-error — 'branchName' is not a valid input
allOptionalAction({ id: 'co', with: { branchName: 'main' } });

// @ts-expect-error — 'name' (required) is missing from upload-artifact with
uploadArtifactV4({ id: 'upload', with: { path: 'dist/' } });

// @ts-expect-error — 'path' (required) is missing from upload-artifact with
uploadArtifactV4({ id: 'upload', with: { name: 'dist' } });

// @ts-expect-error — 'unknownInput' is not a valid input
uploadArtifactV4({
  id: 'upload',
  with: { name: 'dist', path: 'dist/', unknownInput: 'bad' },
});

// @ts-expect-error — 'nodeVersion' (bare required) is missing
setupAction({ id: 'setup' });

console.log('  ✓ All @ts-expect-error annotations compile correctly');
