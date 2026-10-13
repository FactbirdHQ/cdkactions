import {
  App,
  checkoutV7,
  Job,
  nixInstallerActionV23,
  RunnerLabel,
  Stack,
  updateFlakeLockV29,
  Workflow,
} from '@factbird/cdkactions';

const checkout = checkoutV7.pinned('3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7.0.1');
const nixInstaller = nixInstallerActionV23.pinned('3138316df39ed29be04236d7ffc686fa525866aa', 'v23');
const updateFlakeLock = updateFlakeLockV29.pinned('da03c0f078bc4b2c37ee4f7e072d34bf8f188bb3', 'v29');

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

app.synth();
