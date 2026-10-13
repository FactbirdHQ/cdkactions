import {
  cachixActionV16,
  cacheV4,
  checkoutV7,
  createGithubAppTokenV3,
  createPullRequestV8,
  defineAction,
  unwrapToken,
} from '#src/index.ts';

test('checkoutV7 serializes camelCase inputs as kebab-case', () => {
  const step = checkoutV7({ id: 'checkout', with: { fetchDepth: 0, persistCredentials: false } });
  expect(step.uses).toBe('actions/checkout@v7');
  expect(step.with).toEqual({ 'fetch-depth': 0, 'persist-credentials': false });
});

test('outputs keep their action.yml names', () => {
  const token = createGithubAppTokenV3({ id: 'app-token', with: { clientId: 'id', privateKey: 'pem' } });
  expect(unwrapToken(token.outputs['app-slug'])).toBe('steps.app-token.outputs.app-slug');
  const pr = createPullRequestV8({ id: 'pr' });
  expect(unwrapToken(pr.outputs['pull-request-number'])).toBe('steps.pr.outputs.pull-request-number');
});

test('verbatimInputs keep camelCase input names', () => {
  const cachix = cachixActionV16({ with: { name: 'factbird', authToken: 'x' } });
  expect(cachix.with).toEqual({ name: 'factbird', authToken: 'x' });
  const cache = cacheV4({ id: 'cache', with: { path: 'p', key: 'k', enableCrossOsArchive: 'true', restoreKeys: 'r' } });
  expect(cache.with).toEqual({ path: 'p', key: 'k', enableCrossOsArchive: 'true', 'restore-keys': 'r' });
});

test('defineAction without verbatimInputs converts every key', () => {
  const action = defineAction<{ someInput: { default: string } }>('my/action@v1');
  expect(action({ with: { someInput: 'x' } }).with).toEqual({ 'some-input': 'x' });
});
