import { parseWorkflowBumps, resolveVersion, syncPins } from '#src/pin-sync.ts';

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
