import * as fs from 'fs';
import {
  checkoutV7,
  createGithubAppTokenV3,
  DependabotActionPinSync,
  downloadArtifactV8,
  globToRegExpSource,
  Stack,
  uploadArtifactV7,
} from '#src/index.ts';
import { TestingApp } from '#test/utils.ts';

function synthesize(props: ConstructorParameters<typeof DependabotActionPinSync>[2]): string {
  const app = TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(app, 'stack');
  const workflow = new DependabotActionPinSync(stack, 'dependabot-action-pins', props);
  app.synth();
  return fs.readFileSync(`${app.outdir}/${workflow.outputFile}`, 'utf-8');
}

test('DependabotActionPinSync workflow', () => {
  const yaml = synthesize({
    sources: ['cicd/**/*.ts'],
    synthCommand: 'bun run synth:workflows',
    setupSteps: [{ name: 'Install', run: 'bun install --frozen-lockfile' }],
  });
  expect(yaml).toMatchSnapshot();
});

test('every action it emits is pinned to a commit', () => {
  const yaml = synthesize({ sources: ['cicd/main.ts'], synthCommand: 'yarn synth' });
  const uses = [...yaml.matchAll(/uses: (\S+)/g)].map((match) => match[1]);
  expect(uses.length).toBe(4);
  for (const ref of uses) expect(ref).toMatch(/@[0-9a-f]{40}$/);
});

test('custom secrets, repositories and CLI command', () => {
  const yaml = synthesize({
    sources: ['.github/cdk/main.ts'],
    synthCommand: 'cd .github/cdk && yarn synth',
    cliCommand: 'yarn --cwd .github/cdk cdkactions',
    appIdSecret: 'BOT_APP_ID',
    appPrivateKeySecret: 'BOT_APP_PEM',
    repositories: ['flight-deck', 'nest'],
  });
  expect(yaml).toContain('client-id: ${{ secrets.BOT_APP_ID }}');
  expect(yaml).toContain('private-key: ${{ secrets.BOT_APP_PEM }}');
  expect(yaml).toContain('repositories: flight-deck,nest');
  expect(yaml).toContain(
    'yarn --cwd .github/cdk cdkactions sync-action-pins --base "$BASE_SHA" --workflows \'.github/workflows\' --library-pin',
  );
  expect(yaml).toMatch(/--library-pin '[^']+' '\.github\/cdk\/main\.ts'\n/);
});

test('globToRegExpSource matches like fs.globSync', () => {
  const pattern = new RegExp(globToRegExpSource('cicd/**/*.ts'));
  expect(pattern.test('cicd/main.ts')).toBe(true);
  expect(pattern.test('cicd/workflows/ci.ts')).toBe(true);
  expect(pattern.test('cicd/main.js')).toBe(false);
  expect(pattern.test('other/cicd/main.ts')).toBe(false);
  expect(new RegExp(globToRegExpSource('cicd/*.ts')).test('cicd/a/b.ts')).toBe(false);
});

const CONSUMER_CHECKOUT = '1111111111111111111111111111111111111111';

test('DependabotActionPinSync workflow with the consumer actions passed through', () => {
  const yaml = synthesize({
    sources: ['cicd/**/*.ts'],
    synthCommand: 'bun run synth:workflows',
    actions: {
      checkout: checkoutV7.pinned(CONSUMER_CHECKOUT, 'v7.1.0'),
      createGithubAppToken: createGithubAppTokenV3.pinned('2222222222222222222222222222222222222222', 'v3.4.0'),
      uploadArtifact: uploadArtifactV7.pinned('3333333333333333333333333333333333333333', 'v7.1.0'),
      downloadArtifact: downloadArtifactV8.pinned('4444444444444444444444444444444444444444', 'v8.1.0'),
    },
  });
  expect(yaml).toMatchSnapshot();
  expect(yaml).toContain(`uses: actions/checkout@${CONSUMER_CHECKOUT}`);
  expect(yaml).not.toContain('--library-pin');
});

test('each action left at the library default is named as a library pin', () => {
  const yaml = synthesize({
    sources: ['cicd/main.ts'],
    synthCommand: 'bun run synth:workflows',
    actions: { checkout: checkoutV7.pinned(CONSUMER_CHECKOUT, 'v7.1.0') },
  });
  const libraryPins = [...yaml.matchAll(/--library-pin '([^']+)'/g)].map((match) => match[1]);
  expect(libraryPins).toEqual([
    'actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510',
    'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9',
    'actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333',
  ]);
});

test('an action passed without a pin is refused', () => {
  expect(() =>
    synthesize({ sources: ['cicd/main.ts'], synthCommand: 'yarn synth', actions: { checkout: checkoutV7 } }),
  ).toThrow('DependabotActionPinSync: actions.checkout must be pinned to a commit with .pinned(sha, version)');
});
