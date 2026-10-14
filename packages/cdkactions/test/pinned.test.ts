import * as fs from 'fs';
import {
  checkoutV7,
  createGithubAppTokenV3,
  defineAction,
  Job,
  RunnerLabel,
  Stack,
  unwrapToken,
  Workflow,
} from '#src/index.ts';
import { TestingApp } from '#test/utils.ts';

const CHECKOUT_SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';

test('pinned() emits uses at the commit and keeps the typed inputs', () => {
  const checkout = checkoutV7.pinned(CHECKOUT_SHA, 'v7.0.1');
  const step = checkout({ id: 'checkout', with: { fetchDepth: 0 } });
  expect(step.uses).toBe(`actions/checkout@${CHECKOUT_SHA}`);
  expect(step.with).toEqual({ 'fetch-depth': 0 });
  expect(checkout.uses).toBe(`actions/checkout@${CHECKOUT_SHA}`);
  expect(checkout.ref).toBe('actions/checkout@v7');
  expect(checkout.pin).toEqual({ sha: CHECKOUT_SHA, version: 'v7.0.1' });
});

test('pinned() keeps a subpath in the action reference', () => {
  const action = defineAction('owner/repo/path/to/action@v1').pinned(CHECKOUT_SHA, 'v1.2.3');
  expect(action().uses).toBe(`owner/repo/path/to/action@${CHECKOUT_SHA}`);
});

test('an unpinned action has no pin', () => {
  expect(checkoutV7.pin).toBeUndefined();
  expect(checkoutV7({ id: 'checkout' }).uses).toBe('actions/checkout@v7');
});

test('pinned() rejects a tag', () => {
  expect(() => checkoutV7.pinned('v7.0.1', 'v7.0.1')).toThrow(/40-character lowercase hex commit SHA/);
});

test('pinned() rejects a short or uppercase SHA', () => {
  expect(() => checkoutV7.pinned('3d3c42e', 'v7.0.1')).toThrow(/40-character/);
  expect(() => checkoutV7.pinned(CHECKOUT_SHA.toUpperCase(), 'v7.0.1')).toThrow(/40-character/);
});

test('pinned() requires a version', () => {
  expect(() => checkoutV7.pinned(CHECKOUT_SHA, ' ')).toThrow(/release tag/);
});

test('a pinned action exposes typed outputs under their action.yml names', () => {
  const token = createGithubAppTokenV3.pinned(
    '64ab729a6294000f5aa4a4bc0b73d1f32bc45510',
    'v3.3.0',
  )({
    id: 'app-token',
    with: { clientId: 'id', privateKey: 'pem' },
  });
  expect(unwrapToken(token.outputs['app-slug'])).toBe('steps.app-token.outputs.app-slug');
});

test('a pinned step synthesizes with the commit in uses', () => {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'stack');
  const workflow = new Workflow(stack, 'pinned', { name: 'Pinned', on: 'push' });
  new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [checkoutV7.pinned(CHECKOUT_SHA, 'v7.0.1')({ id: 'checkout', with: { persistCredentials: false } })],
  });
  app.synth();
  const yaml = fs.readFileSync(`${app.outdir}/${workflow.outputFile}`, 'utf-8');
  expect(yaml).toContain(`uses: actions/checkout@${CHECKOUT_SHA}`);
  expect(yaml).toContain('persist-credentials: false');
});

test('pinned() rejects a version from another major', () => {
  expect(() => checkoutV7.pinned(CHECKOUT_SHA, 'v6.0.1')).toThrow(/'v6.0.1', which is not a v7 release/);
  expect(() => checkoutV7.pinned(CHECKOUT_SHA, 'v70.0.1')).toThrow(/not a v7 release/);
  expect(() => checkoutV7.pinned(CHECKOUT_SHA, 'main')).toThrow(/not a v7 release/);
});

test('pinned() accepts a version in the reference major, with or without minor and patch', () => {
  expect(checkoutV7.pinned(CHECKOUT_SHA, 'v7.0.1').pin?.version).toBe('v7.0.1');
  expect(defineAction('DeterminateSystems/nix-installer-action@v23').pinned(CHECKOUT_SHA, 'v23').pin?.version).toBe(
    'v23',
  );
  expect(defineAction('cachix/cachix-action@v16').pinned(CHECKOUT_SHA, '16.1.0').pin?.version).toBe('16.1.0');
});

test('pinned() skips the major check for a reference without a major', () => {
  expect(defineAction('my-org/action@main').pinned(CHECKOUT_SHA, 'v3.2.1').pin?.version).toBe('v3.2.1');
  expect(defineAction('my-org/action@v1.2').pinned(CHECKOUT_SHA, 'anything').pin?.version).toBe('anything');
});
