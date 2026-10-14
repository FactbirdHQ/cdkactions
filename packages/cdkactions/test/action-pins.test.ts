import * as fs from 'fs';
import { usePinnedActionChecker } from '#src/action-pins.ts';
import {
  checkoutV7,
  checkPinnedActions,
  type GitHubTags,
  Job,
  RunnerLabel,
  Stack,
  setupBunV2,
  Workflow,
} from '#src/index.ts';
import { TestingApp } from '#test/utils.ts';

const CHECKOUT_SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const MOVED_SHA = '1111111111111111111111111111111111111111';
const BUN_SHA = '0c5077e51419868618aeaa5fe8019c62421857d6';

const TAGS: Record<string, string> = {
  'actions/checkout': [
    `${CHECKOUT_SHA}\trefs/tags/v7.0.1`,
    `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/tags/v7`,
    `${MOVED_SHA}\trefs/tags/v7^{}`,
  ].join('\n'),
  'oven-sh/setup-bun': `${BUN_SHA}\trefs/tags/v2.2.0`,
};

function stubTags(options: { reachable?: boolean; failing?: string } = {}): GitHubTags & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    probe(repository) {
      reads.push(repository);
      return options.reachable === false ? undefined : (TAGS[repository] ?? '');
    },
    listAll(repositories) {
      reads.push(...repositories);
      if (options.failing && repositories.includes(options.failing)) {
        throw new Error(`git ls-remote --tags https://github.com/${options.failing} failed: Connection reset`);
      }
      return new Map(repositories.map((repository) => [repository, TAGS[repository] ?? '']));
    },
  };
}

const checkout = { action: 'actions/checkout', sha: CHECKOUT_SHA, version: 'v7.0.1' };
const bun = { action: 'oven-sh/setup-bun', sha: BUN_SHA, version: 'v2.2.0' };

test('a versioned pin whose tag points at its SHA passes, reading each repository once', () => {
  const tags = stubTags();
  expect(checkPinnedActions([checkout, bun, checkout], tags)).toEqual({
    reachable: true,
    problems: [],
    unversioned: [],
  });
  expect(tags.reads).toEqual(['actions/checkout', 'oven-sh/setup-bun']);
});

test('a tag that moved names the action, the SHA, the version and the new commit', () => {
  const result = checkPinnedActions([{ action: 'actions/checkout', sha: CHECKOUT_SHA, version: 'v7' }], stubTags());
  expect(result).toEqual({
    reachable: true,
    unversioned: [],
    problems: [
      `actions/checkout@${CHECKOUT_SHA} names v7, but v7 now points at ${MOVED_SHA}. ` +
        'If nobody changed this pin, the tag moved after the pin was reviewed.',
    ],
  });
});

test('a missing tag fails', () => {
  const result = checkPinnedActions([{ ...checkout, version: 'v7.0.9' }], stubTags());
  expect(result.reachable && result.problems).toEqual([
    `actions/checkout@${CHECKOUT_SHA} names v7.0.9, but actions/checkout has no tag v7.0.9`,
  ]);
});

test('a pin without a version is not checked and reads nothing', () => {
  const tags = stubTags();
  const unversioned = { action: 'actions/checkout', sha: MOVED_SHA };
  expect(checkPinnedActions([unversioned], tags)).toEqual({
    reachable: true,
    problems: [],
    unversioned: [unversioned],
  });
  expect(tags.reads).toEqual([]);
});

test('an unreachable GitHub leaves the versioned pins unverified', () => {
  expect(checkPinnedActions([checkout], stubTags({ reachable: false }))).toEqual({
    reachable: false,
    unverified: [checkout],
  });
});

test('a read that fails after the probe answered throws', () => {
  expect(() => checkPinnedActions([checkout, bun], stubTags({ failing: 'oven-sh/setup-bun' }))).toThrow(
    /oven-sh\/setup-bun failed: Connection reset/,
  );
});

function synthWithPins(tags: GitHubTags, version = 'v7.0.1') {
  const app = TestingApp({ createValidateWorkflow: false });
  usePinnedActionChecker((pins) => checkPinnedActions(pins, tags));
  const stack = new Stack(app, 'stack');
  const workflow = new Workflow(stack, 'pinned', { name: 'Pinned', on: 'push' });
  new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [checkoutV7.pinned(CHECKOUT_SHA, version)({ id: 'checkout' }), setupBunV2.pinned(BUN_SHA)({ id: 'bun' })],
  });
  return { app, file: () => `${app.outdir}/${workflow.outputFile}` };
}

function withGitHubActions<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.GITHUB_ACTIONS;
  if (value === undefined) delete process.env.GITHUB_ACTIONS;
  else process.env.GITHUB_ACTIONS = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = previous;
  }
}

test('synth passes when GitHub is reachable and every tag matches', () => {
  const { app, file } = synthWithPins(stubTags());
  app.synth();
  expect(fs.existsSync(file())).toBe(true);
});

test('synth fails when GitHub is reachable and a tag does not match', () => {
  const { app } = synthWithPins(stubTags(), 'v7');
  expect(() => app.synth()).toThrow(/names v7, but v7 now points at 1111111111111111111111111111111111111111/);
});

test('synth warns and goes on when GitHub is unreachable outside GitHub Actions', () => {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const { app, file } = synthWithPins(stubTags({ reachable: false }));
    withGitHubActions(undefined, () => app.synth());
    expect(fs.existsSync(file())).toBe(true);
    expect(warnings).toEqual([
      `WARNING: GitHub is unreachable, so these pins are unverified: actions/checkout@${CHECKOUT_SHA} (v7.0.1)`,
    ]);
  } finally {
    console.warn = warn;
  }
});

test('synth fails when GitHub is unreachable under GitHub Actions', () => {
  const { app } = synthWithPins(stubTags({ reachable: false }));
  expect(() => withGitHubActions('true', () => app.synth())).toThrow(/GitHub is unreachable from this runner/);
});

test('synth fails when a read fails partway through', () => {
  const { app } = synthWithPins({
    probe: () => TAGS['actions/checkout'],
    listAll: () => {
      throw new Error('git ls-remote --tags https://github.com/oven-sh/setup-bun failed: Connection reset');
    },
  });
  const bunPinned = new Stack(app, 'bun');
  const bunWorkflow = new Workflow(bunPinned, 'bun', { name: 'Bun', on: 'push' });
  new Job(bunWorkflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [setupBunV2.pinned(BUN_SHA, 'v2.2.0')({ id: 'bun' })],
  });
  expect(() => app.synth()).toThrow(/Connection reset/);
});
