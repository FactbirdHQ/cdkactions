import type { GitHubTags } from '@factbird/cdkactions';
import {
  describeLibraryOwnedBump,
  findLocalDefinitions,
  findSourcePins,
  parseWorkflowBumps,
  resolveVersion,
  syncPins,
  verifyPins,
} from '#src/pin-sync.ts';

const CHECKOUT_OLD = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const CHECKOUT_NEW = '1111111111111111111111111111111111111111';
const AWS_OLD = 'e1253824e5c10ff9df46874f81ed3ec929e19cfd';
const AWS_NEW = '2222222222222222222222222222222222222222';
const SUBPATH_OLD = '3333333333333333333333333333333333333333';
const SUBPATH_NEW = '4444444444444444444444444444444444444444';

function workflowDiff(file: string, changes: Array<[string, string, string]>): string {
  const lines = [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, '@@ -1,4 +1,4 @@'];
  for (const [action, oldRef, newRef] of changes) {
    lines.push(`-      - uses: ${action}@${oldRef}`, `+      - uses: ${action}@${newRef}`);
  }
  return lines.join('\n');
}

const noVersions = new Map<string, string | undefined>();

test('pairs a subpath action', () => {
  const diff = workflowDiff('.github/workflows/cdkactions_ci.yaml', [
    ['github/codeql-action/init', SUBPATH_OLD, SUBPATH_NEW],
  ]);
  expect(parseWorkflowBumps(diff)).toEqual([
    { action: 'github/codeql-action/init', oldRef: SUBPATH_OLD, newRef: SUBPATH_NEW },
  ]);
});

test('pairs two actions in one diff and ignores hand-written workflows', () => {
  const diff = [
    workflowDiff('.github/workflows/cdkactions_ci.yaml', [
      ['actions/checkout', CHECKOUT_OLD, CHECKOUT_NEW],
      ['aws-actions/configure-aws-credentials', AWS_OLD, AWS_NEW],
    ]),
    workflowDiff('.github/workflows/release.yaml', [['actions/cache', 'v3', 'v4']]),
  ].join('\n');
  expect(parseWorkflowBumps(diff)).toEqual([
    { action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW },
    { action: 'aws-actions/configure-aws-credentials', oldRef: AWS_OLD, newRef: AWS_NEW },
  ]);
});

test('rewrites the same action pinned in several places, with the version comment', () => {
  const source = [
    `const a = { uses: 'actions/checkout@${CHECKOUT_OLD}' }; // v7.0.1`,
    `const b = { uses: 'actions/checkout@${CHECKOUT_OLD}', with: {} }; // v7.0.1`,
    `const c = { uses: 'actions/checkout@${CHECKOUT_OLD}' };`,
  ].join('\n');
  const result = syncPins(
    [{ path: 'cicd/main.ts', text: source }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }],
    new Map([[CHECKOUT_NEW, 'v7.1.0']]),
  );
  expect(result.errors).toEqual([]);
  expect(result.files[0].text).toBe(
    [
      `const a = { uses: 'actions/checkout@${CHECKOUT_NEW}' }; // v7.1.0`,
      `const b = { uses: 'actions/checkout@${CHECKOUT_NEW}', with: {} }; // v7.1.0`,
      `const c = { uses: 'actions/checkout@${CHECKOUT_NEW}' };`,
    ].join('\n'),
  );
  expect(result.rewrites[0].locations).toEqual(['cicd/main.ts:1', 'cicd/main.ts:2', 'cicd/main.ts:3']);
});

test('rewrites the typed pinned() form, also across lines', () => {
  const source = [
    `const checkout = checkoutV7.pinned('${CHECKOUT_OLD}', 'v7.0.1');`,
    'const aws = configureAwsCredentialsV6.pinned(',
    `  '${AWS_OLD}',`,
    "  'v6.3.0',",
    ');',
  ].join('\n');
  const result = syncPins(
    [{ path: 'cicd/actions.ts', text: source }],
    [
      { action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW },
      { action: 'aws-actions/configure-aws-credentials', oldRef: AWS_OLD, newRef: AWS_NEW },
    ],
    new Map([
      [CHECKOUT_NEW, 'v7.1.0'],
      [AWS_NEW, 'v6.4.0'],
    ]),
  );
  expect(result.errors).toEqual([]);
  expect(result.files[0].text).toBe(
    [
      `const checkout = checkoutV7.pinned('${CHECKOUT_NEW}', 'v7.1.0');`,
      'const aws = configureAwsCredentialsV6.pinned(',
      `  '${AWS_NEW}',`,
      "  'v6.4.0',",
      ');',
    ].join('\n'),
  );
  expect(result.rewrites.map((rewrite) => rewrite.locations)).toEqual([['cicd/actions.ts:1'], ['cicd/actions.ts:3']]);
});

test('does not touch an action whose name ends with the bumped one', () => {
  const source = `uses: 'my-org/actions/checkout@${CHECKOUT_OLD}', // v7.0.1\nuses: 'actions/checkout@${CHECKOUT_OLD}', // v7.0.1`;
  const result = syncPins(
    [{ path: 'main.ts', text: source }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }],
    noVersions,
  );
  expect(result.files[0].text).toBe(
    `uses: 'my-org/actions/checkout@${CHECKOUT_OLD}', // v7.0.1\nuses: 'actions/checkout@${CHECKOUT_NEW}', // v7.0.1`,
  );
});

test('refuses a tag ref and names the action', () => {
  const result = syncPins(
    [{ path: 'main.ts', text: `uses: 'actions/checkout@${CHECKOUT_OLD}'` }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: 'v8' }],
    noVersions,
  );
  expect(result.errors).toEqual(["actions/checkout: moved to 'v8', which is not a 40-character commit SHA"]);
  expect(result.files[0].text).toBe(`uses: 'actions/checkout@${CHECKOUT_OLD}'`);
});

test('fails when no source pins the old commit', () => {
  const result = syncPins(
    [{ path: 'main.ts', text: "uses: 'actions/checkout@v4'" }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }],
    noVersions,
  );
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain(`actions/checkout@${CHECKOUT_OLD}: no source file pins it`);
});

test('reports a bump the sources already carry instead of failing', () => {
  const result = syncPins(
    [{ path: 'main.ts', text: `checkoutV7.pinned('${CHECKOUT_NEW}', 'v7.1.0')` }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }],
    noVersions,
  );
  expect(result.errors).toEqual([]);
  expect(result.alreadyCarried).toHaveLength(1);
});

test('leaves the version alone when no tag points at the new commit', () => {
  const result = syncPins(
    [{ path: 'main.ts', text: `uses: 'actions/checkout@${CHECKOUT_OLD}', // v7.0.1` }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }],
    new Map([[CHECKOUT_NEW, undefined]]),
  );
  expect(result.files[0].text).toBe(`uses: 'actions/checkout@${CHECKOUT_NEW}', // v7.0.1`);
  expect(result.rewrites[0].version).toBeUndefined();
});

test('resolveVersion picks the most specific tag and reads peeled annotated tags', () => {
  const lsRemote = [
    `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/tags/v7`,
    `${CHECKOUT_NEW}\trefs/tags/v7^{}`,
    `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v7.1.0`,
    `${CHECKOUT_NEW}\trefs/tags/v7.1.0^{}`,
    `${CHECKOUT_NEW}\trefs/tags/v7.1`,
    `${CHECKOUT_NEW}\trefs/tags/latest`,
    `${CHECKOUT_OLD}\trefs/tags/v7.0.1`,
  ].join('\n');
  expect(resolveVersion(lsRemote, CHECKOUT_NEW)).toBe('v7.1.0');
  expect(resolveVersion(lsRemote, CHECKOUT_OLD)).toBe('v7.0.1');
  expect(resolveVersion(lsRemote, '5555555555555555555555555555555555555555')).toBeUndefined();
});

const helpers = new Map([['checkoutV7', 'actions/checkout']]);

const checkoutTags = [
  `${CHECKOUT_OLD}\trefs/tags/v7.0.1`,
  'cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v7',
  `${CHECKOUT_NEW}\trefs/tags/v7^{}`,
].join('\n');

function stubTags(tags: Record<string, string>, reachable = true): GitHubTags & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    probe(repository) {
      reads.push(repository);
      return reachable ? (tags[repository] ?? '') : undefined;
    },
    listAll(repositories) {
      reads.push(...repositories);
      return new Map(repositories.map((repository) => [repository, tags[repository] ?? '']));
    },
  };
}

function pinsOf(text: string) {
  return findSourcePins({ path: 'cicd/main.ts', text }, helpers);
}

test('findSourcePins reads both forms, with and without a version', () => {
  const pins = pinsOf(
    [
      `const checkout = checkoutV7.pinned('${CHECKOUT_OLD}', 'v7.0.1');`,
      `const bare = checkoutV7.pinned('${CHECKOUT_NEW}');`,
      `const aws = { uses: 'aws-actions/configure-aws-credentials@${AWS_OLD}' }; // v6.3.0`,
      `const plain = { uses: 'aws-actions/configure-aws-credentials@${AWS_NEW}' };`,
      "const tag = { uses: 'actions/cache@v4' };",
    ].join('\n'),
  );
  expect(pins.map(({ form, action, ref, version, line }) => ({ form, action, ref, version, line }))).toEqual([
    { form: 'typed', action: 'actions/checkout', ref: CHECKOUT_OLD, version: 'v7.0.1', line: 1 },
    { form: 'typed', action: 'actions/checkout', ref: CHECKOUT_NEW, version: undefined, line: 2 },
    { form: 'plain', action: 'aws-actions/configure-aws-credentials', ref: AWS_OLD, version: 'v6.3.0', line: 3 },
    { form: 'plain', action: 'aws-actions/configure-aws-credentials', ref: AWS_NEW, version: undefined, line: 4 },
    { form: 'plain', action: 'actions/cache', ref: 'v4', version: undefined, line: 5 },
  ]);
});

test('findLocalDefinitions maps a defineAction declared in the sources', () => {
  const text = "const deployV2 = defineAction<{ env: { required: true } }>('my-org/deploy/action@v2');";
  expect([...findLocalDefinitions([{ path: 'actions.ts', text }])]).toEqual([['deployV2', 'my-org/deploy/action']]);
});

test('sync rewrites only the SHA of an unversioned pin, in both forms', () => {
  const source = [
    `const bare = checkoutV7.pinned('${CHECKOUT_OLD}');`,
    `const plain = { uses: 'actions/checkout@${CHECKOUT_OLD}' };`,
  ].join('\n');
  const result = syncPins(
    [{ path: 'cicd/main.ts', text: source }],
    [{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }],
    new Map([[CHECKOUT_NEW, 'v7.1.0']]),
    helpers,
  );
  expect(result.errors).toEqual([]);
  expect(result.files[0].text).toBe(
    [
      `const bare = checkoutV7.pinned('${CHECKOUT_NEW}');`,
      `const plain = { uses: 'actions/checkout@${CHECKOUT_NEW}' };`,
    ].join('\n'),
  );
});

test('verifyPins passes a versioned pin whose tag points at it, in both forms, and skips unversioned pins', () => {
  const tags = stubTags({ 'actions/checkout': checkoutTags });
  const result = verifyPins(
    pinsOf(
      [
        `checkoutV7.pinned('${CHECKOUT_OLD}', 'v7.0.1');`,
        `const step = { uses: 'actions/checkout@${CHECKOUT_NEW}' }; // v7`,
        `checkoutV7.pinned('${CHECKOUT_NEW}');`,
        `const bare = { uses: 'actions/checkout@${CHECKOUT_OLD}' };`,
      ].join('\n'),
    ),
    tags,
  );
  expect(result.problems).toEqual([]);
  expect(result.verified.map((pin) => pin.line)).toEqual([1, 2]);
  expect(result.unversioned.map((pin) => pin.line)).toEqual([3, 4]);
  expect(tags.reads).toEqual(['actions/checkout']);
});

test('verifyPins reports a tag that moved after review, in both forms', () => {
  const result = verifyPins(
    pinsOf(
      [
        `checkoutV7.pinned('${CHECKOUT_OLD}', 'v7');`,
        `const step = { uses: 'actions/checkout@${CHECKOUT_OLD}' }; // v7`,
      ].join('\n'),
    ),
    stubTags({ 'actions/checkout': checkoutTags }),
  );
  const message =
    `actions/checkout@${CHECKOUT_OLD} names v7, but v7 now points at ${CHECKOUT_NEW}. ` +
    'If nobody changed this pin, the tag moved after the pin was reviewed.';
  expect(result.problems).toEqual([`cicd/main.ts:1: ${message}`, `cicd/main.ts:2: ${message}`]);
});

test('verifyPins reports a missing tag', () => {
  const result = verifyPins(
    pinsOf(`const step = { uses: 'actions/checkout@${CHECKOUT_OLD}' }; // v7.0.9`),
    stubTags({ 'actions/checkout': checkoutTags }),
  );
  expect(result.problems).toEqual([
    `cicd/main.ts:1: actions/checkout@${CHECKOUT_OLD} names v7.0.9, but actions/checkout has no tag v7.0.9`,
  ]);
});

test('verifyPins fails when GitHub is unreachable', () => {
  const result = verifyPins(pinsOf(`checkoutV7.pinned('${CHECKOUT_OLD}', 'v7.0.1');`), stubTags({}, false));
  expect(result.problems).toEqual(['GitHub is unreachable, so 1 versioned pin(s) could not be verified']);
});

test('verifyPins reports a versioned typed pin of an unknown helper', () => {
  const result = verifyPins(pinsOf(`mystery.pinned('${CHECKOUT_OLD}', 'v1.0.0');`), stubTags({}));
  expect(result.problems).toEqual([
    `cicd/main.ts:1: mystery.pinned('${CHECKOUT_OLD}') is not a known action, so its tag cannot be checked`,
  ]);
});

const PIN_SYNC_WORKFLOW = '.github/workflows/cdkactions_dependabot-action-pins.yaml';

test('a checkout passed through the construct moves every workflow from one source constant', () => {
  const diff = [
    workflowDiff('.github/workflows/cdkactions_ci.yaml', [['actions/checkout', CHECKOUT_OLD, CHECKOUT_NEW]]),
    workflowDiff(PIN_SYNC_WORKFLOW, [['actions/checkout', CHECKOUT_OLD, CHECKOUT_NEW]]),
  ].join('\n');
  const bumps = parseWorkflowBumps(diff);
  expect(bumps).toEqual([{ action: 'actions/checkout', oldRef: CHECKOUT_OLD, newRef: CHECKOUT_NEW }]);
  const source = [
    `const checkout = checkoutV7.pinned('${CHECKOUT_OLD}', 'v7.0.1');`,
    "new DependabotActionPinSync(stack, 'dependabot-action-pins', { actions: { checkout }, sources, synthCommand });",
  ].join('\n');
  const result = syncPins(
    [{ path: 'cicd/main.ts', text: source }],
    bumps,
    new Map([[CHECKOUT_NEW, 'v7.1.0']]),
    helpers,
    new Set(['actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9']),
  );
  expect(result.errors).toEqual([]);
  expect(result.libraryOwned).toEqual([]);
  expect(result.files[0].text.split('\n')[0]).toBe(`const checkout = checkoutV7.pinned('${CHECKOUT_NEW}', 'v7.1.0');`);
});

test('a bump of a library-default pin is reported as library-owned, not as drift', () => {
  const bumps = parseWorkflowBumps(workflowDiff(PIN_SYNC_WORKFLOW, [['actions/checkout', CHECKOUT_OLD, CHECKOUT_NEW]]));
  const libraryPins = new Set([`actions/checkout@${CHECKOUT_OLD}`]);
  const other = { path: 'cicd/main.ts', text: `const aws = configureAwsCredentialsV6.pinned('${AWS_OLD}', 'v6.3.0');` };

  const notInSources = syncPins([other], bumps, noVersions, helpers, libraryPins);
  expect(notInSources.errors).toEqual([]);
  expect(notInSources.libraryOwned).toEqual(bumps);
  expect(notInSources.alreadyCarried).toEqual([]);
  expect(notInSources.files[0].text).toBe(other.text);

  const sharedWithSources = syncPins(
    [{ path: 'cicd/main.ts', text: `const checkout = checkoutV7.pinned('${CHECKOUT_OLD}', 'v7.0.1');` }],
    bumps,
    new Map([[CHECKOUT_NEW, 'v7.1.0']]),
    helpers,
    libraryPins,
  );
  expect(sharedWithSources.errors).toEqual([]);
  expect(sharedWithSources.libraryOwned).toEqual(bumps);
  expect(sharedWithSources.files[0].text).toBe(`const checkout = checkoutV7.pinned('${CHECKOUT_NEW}', 'v7.1.0');`);

  expect(describeLibraryOwnedBump(bumps[0])).toBe(
    `actions/checkout ${CHECKOUT_OLD} -> ${CHECKOUT_NEW}: a DependabotActionPinSync step runs this action at the ` +
      `cdkactions library's pin rather than a source pin, so a resynth would write ${CHECKOUT_OLD} back into its workflow. ` +
      "Pass the action through the construct's `actions` prop, or wait for a cdkactions release that ships the new pin.",
  );
});
