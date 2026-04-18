import {
  App, Stack, Workflow, Job, RunnerLabel,
  Action,
} from '#@/index.js';
import { TestingApp } from '../test/utils.js';

const checkoutV4 = Action.fromReference<
  {
    repository: { default: '${{ github.repository }}' };
    ref: { default: '' };
    token: { default: '${{ github.token }}' };
    sshKey: { default: '' };
    persistCredentials: { default: 'true' };
    path: { default: '.' };
    clean: { default: 'true' };
    fetchDepth: { default: '1' };
    fetchTags: { default: 'false' };
    lfs: { default: 'false' };
    submodules: { default: 'false' };
  },
  {
    ref: {};
    commit: {};
  }
>('actions/checkout@v4');

const setupNodeV4 = Action.fromReference<
  {
    nodeVersion: { default: '' };
    nodeVersionFile: { default: '' };
    registryUrl: { default: '' };
    cache: { default: '' };
    cacheDependencyPath: { default: '' };
    token: { default: '${{ github.token }}' };
  },
  {
    cacheHit: {};
    nodeVersion: {};
  }
>('actions/setup-node@v4');

const uploadArtifactV4 = Action.fromReference<
  {
    name: { required: true };
    path: { required: true };
    retentionDays: { default: '' };
    compressionLevel: { default: '6' };
    overwrite: { default: 'false' };
  },
  {
    artifactId: {};
    artifactUrl: {};
  }
>('actions/upload-artifact@v4');

export function create(app?: App) {
  const _app = app ?? TestingApp({ createValidateWorkflow: false });
  const stack = new Stack(_app, 'action-refs');

  const workflow = new Workflow(stack, 'build', {
    name: 'Build with Action',
    on: { push: { branches: ['main'] } },
  });

  const co = checkoutV4.call({ id: 'co', with: { fetchDepth: 0, lfs: true } });
  const node = setupNodeV4.call({ id: 'node', with: { nodeVersion: '20', cache: 'npm' } });
  const upload = uploadArtifactV4.call({
    id: 'upload',
    with: { name: 'dist', path: 'dist/' },
  });

  co.output('commit');
  node.output('cacheHit');
  upload.output('artifactId');

  new Job(workflow, 'build', {
    runsOn: RunnerLabel.UBUNTU_LATEST,
    steps: [
      co,
      node,
      { name: 'Build', run: 'npm run build' },
      upload,
    ],
  });

  return _app;
}

// @ts-expect-error — 'branchName' is not an input of checkout
checkoutV4.call({ id: 'x', with: { branchName: 'main' } });

// @ts-expect-error — 'name' is required for upload-artifact
uploadArtifactV4.call({ id: 'x', with: { path: 'dist/' } });

// @ts-expect-error — 'digest' is not an output of checkout
checkoutV4.call({ id: 'x' }).output('digest');
