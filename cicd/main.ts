import { App, Job, RunnerLabel, Stack, Workflow } from '@factbird/cdkactions';

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
    {
      uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', // v7.0.1
    },
    {
      name: 'Install Nix',
      uses: 'DeterminateSystems/nix-installer-action@3138316df39ed29be04236d7ffc686fa525866aa', // v23
    },
    {
      name: 'Update nixpkgs',
      uses: 'DeterminateSystems/update-flake-lock@da03c0f078bc4b2c37ee4f7e072d34bf8f188bb3', // v29
      with: {
        inputs: 'nixpkgs',
        branch: 'chore/update-nixpkgs',
        'commit-msg': 'chore(nix): update nixpkgs',
        'pr-title': 'chore(nix): update nixpkgs',
      },
    },
  ],
});

app.synth();
