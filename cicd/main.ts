import {
  App,
  checkoutV7,
  createGithubAppTokenV3,
  DependabotActionPinSync,
  downloadArtifactV8,
  Job,
  nixInstallerActionV23,
  RunnerLabel,
  setupBunV2,
  Stack,
  updateFlakeLockV29,
  uploadArtifactV7,
  Workflow,
} from '@factbird/cdkactions';

const checkout = checkoutV7.pinned('3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1');
const nixInstaller = nixInstallerActionV23.pinned('3138316df39ed29be04236d7ffc686fa525866aa', 'v23');
const updateFlakeLock = updateFlakeLockV29.pinned('da03c0f078bc4b2c37ee4f7e072d34bf8f188bb3', 'v29');
const setupBun = setupBunV2.pinned('0c5077e51419868618aeaa5fe8019c62421857d6', 'v2.2.0');
const createGithubAppToken = createGithubAppTokenV3.pinned('64ab729a6294000f5aa4a4bc0b73d1f32bc45510', 'v3.3.0');
const uploadArtifact = uploadArtifactV7.pinned('cf430e030ddbb5b0abf93d22962f4752f3646cd9', 'v7.0.2');
const downloadArtifact = downloadArtifactV8.pinned('9000827ccba6bdab643e8b6fd33ac0654aef8333', 'v8.0.2');

const app = new App({
  outdir: '.github/workflows',
  createValidateWorkflow: false,
});
const stack = new Stack(app, 'cdkactions');

/**
 * The repository is public, so the organization's GitHub App secrets do not
 * reach it and the pull request is opened with GITHUB_TOKEN. GitHub starts no
 * workflow for events caused by GITHUB_TOKEN, so CI runs on that pull request
 * only once someone pushes to it or closes and reopens it.
 */
const updateNixpkgs = new Workflow(stack, 'update-nixpkgs', {
  name: 'Update nixpkgs',
  on: {
    schedule: [{ cron: '0 4 * * 1' }],
    workflowDispatch: null,
  },
  permissions: { contents: 'read' },
});

new Job(updateNixpkgs, 'update', {
  runsOn: RunnerLabel.UBUNTU_LATEST,
  permissions: { contents: 'write', pullRequests: 'write' },
  steps: [
    checkout({ id: 'checkout' }),
    nixInstaller({ name: 'Install Nix' }),
    updateFlakeLock({
      id: 'update',
      name: 'Update nixpkgs',
      with: {
        inputs: 'nixpkgs',
        branch: 'chore/update-nixpkgs',
        commitMsg: 'chore(nix): update nixpkgs',
        prTitle: 'chore(nix): update nixpkgs',
      },
    }),
  ],
});

const verifyActionPins = new Workflow(stack, 'verify-action-pins', {
  name: 'Verify action pins',
  on: {
    pullRequest: {},
    push: { branches: ['master'] },
  },
  permissions: { contents: 'read' },
});

new Job(verifyActionPins, 'verify', {
  runsOn: RunnerLabel.UBUNTU_LATEST,
  steps: [
    checkout({ id: 'checkout', with: { persistCredentials: false } }),
    setupBun({ id: 'bun' }),
    { name: 'Install', run: 'bun install --frozen-lockfile' },
    { name: 'Build', run: 'bun run build' },
    {
      name: 'Verify action pins',
      run: "node packages/cdkactions-cli/bin/cdkactions verify-action-pins 'cicd/**/*.ts'",
    },
  ],
});

new DependabotActionPinSync(stack, 'dependabot-action-pins', {
  sources: ['cicd/main.ts'],
  setupSteps: [
    setupBun({ id: 'bun' }),
    { name: 'Install', run: 'bun install --frozen-lockfile' },
    { name: 'Build', run: 'bun run build' },
  ],
  cliCommand: 'node packages/cdkactions-cli/bin/cdkactions',
  synthCommand: 'bun run synth:workflows',
  actions: { checkout, createGithubAppToken, uploadArtifact, downloadArtifact },
});

app.synth();
