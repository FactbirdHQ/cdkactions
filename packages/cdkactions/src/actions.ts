import { Action } from '#@/action.js';

export const checkoutV2 = Action.fromReference<{
  repository: { default: string };
  ref: { default: string };
  token: { default: string };
  sshKey: { default: string };
  sshKnownHosts: { default: string };
  sshStrict: { default: string };
  persistCredentials: { default: string };
  path: { default: string };
  clean: { default: string };
  fetchDepth: { default: string };
  lfs: { default: string };
  submodules: { default: string };
  setSafeDirectory: { default: string };
}>('actions/checkout@v2');

export const checkoutV3 = Action.fromReference<{
  repository: { default: string };
  ref: { default: string };
  token: { default: string };
  sshKey: { default: string };
  sshKnownHosts: { default: string };
  sshStrict: { default: string };
  persistCredentials: { default: string };
  path: { default: string };
  clean: { default: string };
  sparseCheckout: { default: string };
  sparseCheckoutConeMode: { default: string };
  fetchDepth: { default: string };
  fetchTags: { default: string };
  lfs: { default: string };
  submodules: { default: string };
  setSafeDirectory: { default: string };
  githubServerUrl: { default: string };
}>('actions/checkout@v3');

export const checkoutV4 = Action.fromReference<{
  repository: { default: string };
  ref: { default: string };
  token: { default: string };
  sshKey: { default: string };
  sshKnownHosts: { default: string };
  sshStrict: { default: string };
  sshUser: { default: string };
  persistCredentials: { default: string };
  path: { default: string };
  clean: { default: string };
  filter: { default: string };
  sparseCheckout: { default: string };
  sparseCheckoutConeMode: { default: string };
  fetchDepth: { default: string };
  fetchTags: { default: string };
  showProgress: { default: string };
  lfs: { default: string };
  submodules: { default: string };
  setSafeDirectory: { default: string };
  githubServerUrl: { default: string };
}>('actions/checkout@v4');
