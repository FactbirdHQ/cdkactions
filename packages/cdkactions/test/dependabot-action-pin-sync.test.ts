import * as fs from 'fs';
import { DependabotActionPinSync, globToRegExpSource, Stack } from '#src/index.ts';
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
    "yarn --cwd .github/cdk cdkactions sync-action-pins --base \"$BASE_SHA\" --workflows '.github/workflows' '.github/cdk/main.ts'",
  );
});

test('globToRegExpSource matches like fs.globSync', () => {
  const pattern = new RegExp(globToRegExpSource('cicd/**/*.ts'));
  expect(pattern.test('cicd/main.ts')).toBe(true);
  expect(pattern.test('cicd/workflows/ci.ts')).toBe(true);
  expect(pattern.test('cicd/main.js')).toBe(false);
  expect(pattern.test('other/cicd/main.ts')).toBe(false);
  expect(new RegExp(globToRegExpSource('cicd/*.ts')).test('cicd/a/b.ts')).toBe(false);
});
