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

export const setupNodeV6 = Action.fromReference<
  {
    nodeVersion: { default: string };
    nodeVersionFile: { default: string };
    architecture: { default: string };
    checkLatest: { default: string };
    registryUrl: { default: string };
    scope: { default: string };
    token: { default: string };
    cache: { default: string };
    packageManagerCache: { default: string };
    cacheDependencyPath: { default: string };
    mirror: { default: string };
    mirrorToken: { default: string };
  },
  {
    cacheHit: { description: string };
    nodeVersion: { description: string };
  }
>('actions/setup-node@v6');

export const setupGoV6 = Action.fromReference<
  {
    goVersion: { default: string };
    goVersionFile: { default: string };
    checkLatest: { default: string };
    token: { default: string };
    cache: { default: string };
    cacheDependencyPath: { default: string };
    architecture: { default: string };
    goDownloadBaseUrl: { default: string };
  },
  {
    goVersion: { description: string };
    cacheHit: { description: string };
  }
>('actions/setup-go@v6');

export const setupJavaV5 = Action.fromReference<
  {
    javaVersion: { default: string };
    javaVersionFile: { default: string };
    distribution: { required: true };
    javaPackage: { default: string };
    architecture: { default: string };
    jdkFile: { default: string };
    checkLatest: { default: string };
    serverId: { default: string };
    serverUsername: { default: string };
    serverPassword: { default: string };
    settingsPath: { default: string };
    overwriteSettings: { default: string };
    gpgPrivateKey: { default: string };
    gpgPassphrase: { default: string };
    cache: { default: string };
    cacheDependencyPath: { default: string };
    jobStatus: { default: string };
    token: { default: string };
    mvnToolchainId: { default: string };
    mvnToolchainVendor: { default: string };
  },
  {
    distribution: { description: string };
    version: { description: string };
    path: { description: string };
    cacheHit: { description: string };
  }
>('actions/setup-java@v5');

export const setupPythonV6 = Action.fromReference<
  {
    pythonVersion: { default: string };
    pythonVersionFile: { default: string };
    cache: { default: string };
    architecture: { default: string };
    checkLatest: { default: string };
    token: { default: string };
    cacheDependencyPath: { default: string };
    updateEnvironment: { default: string };
    allowPrereleases: { default: string };
    freethreaded: { default: string };
    pipVersion: { default: string };
    pipInstall: { default: string };
  },
  {
    pythonVersion: { description: string };
    cacheHit: { description: string };
    pythonPath: { description: string };
  }
>('actions/setup-python@v6');

export const setupRubyV1 = Action.fromReference<
  {
    rubyVersion: { default: string };
    rubygems: { default: string };
    bundler: { default: string };
    bundlerCache: { default: string };
    workingDirectory: { default: string };
    cacheVersion: { default: string };
    selfHosted: { default: string };
    windowsToolchain: { default: string };
    token: { default: string };
  },
  {
    rubyPrefix: { description: string };
  }
>('ruby/setup-ruby@v1');

export const createGithubAppTokenV3 = Action.fromReference<
  {
    clientId: { default: string };
    privateKey: { required: true };
    owner: { default: string };
    repositories: { default: string };
    skipTokenRevoke: { default: string };
    githubApiUrl: { default: string };
  },
  {
    token: { description: string };
    installationId: { description: string };
    appSlug: { description: string };
  }
>('actions/create-github-app-token@v3');

export const githubScriptV9 = Action.fromReference<
  {
    script: { required: true };
    githubToken: { default: string };
    debug: { default: string };
    userAgent: { default: string };
    previews: { default: string };
    resultEncoding: { default: string };
    retries: { default: string };
    retryExemptStatusCodes: { default: string };
    baseUrl: { default: string };
  },
  {
    result: { description: string };
  }
>('actions/github-script@v9');

export const addToProjectV1 = Action.fromReference<
  {
    projectUrl: { required: true };
    githubToken: { required: true };
    labeled: { default: string };
    labelOperator: { default: string };
  },
  {
    itemId: { description: string };
  }
>('actions/add-to-project@v1');

export const publishImmutableActionV1 = Action.fromReference<
  {
    githubToken: { default: string };
  },
  {
    packageManifestSha: { description: string };
    attestationManifestSha: { description: string };
    referrerIndexManifestSha: { description: string };
  }
>('actions/publish-immutable-action@v1');

export const uploadReleaseAssetV1 = Action.fromReference<
  {
    upload_url: { required: true };
    asset_path: { required: true };
    asset_name: { required: true };
    asset_content_type: { required: true };
  },
  {
    browser_download_url: { description: string };
  }
>('actions/upload-release-asset@v1');

export const createReleaseV1 = Action.fromReference<
  {
    tag_name: { required: true };
    release_name: { required: true };
    body: { default: string };
    body_path: { default: string };
    draft: { default: string };
    prerelease: { default: string };
    commitish: { default: string };
    owner: { default: string };
    repo: { default: string };
  },
  {
    id: { description: string };
    html_url: { description: string };
    upload_url: { description: string };
  }
>('actions/create-release@v1');

export const determinateNixV3 = Action.fromReference<{
  extraConf: { default: string };
  githubServerUrl: { default: string };
  githubToken: { default: string };
  trustRunnerUser: { default: string };
  summarize: { default: string };
  forceNoSystemd: { default: string };
  init: { default: string };
  kvm: { default: string };
  planner: { default: string };
  proxy: { default: string };
  reinstall: { default: string };
  sourceBinary: { default: string };
  sourceBranch: { default: string };
  sourcePr: { default: string };
  sourceRevision: { default: string };
  sourceTag: { default: string };
  sourceUrl: { default: string };
  backtrace: { default: string };
  diagnosticEndpoint: { default: string };
  logDirectives: { default: string };
  logger: { default: string };
}>('DeterminateSystems/determinate-nix-action@v3');

export const installNixActionV31 = Action.fromReference<{
  extra_nix_config: { default: string };
  github_access_token: { default: string };
  install_url: { default: string };
  install_options: { default: string };
  nix_path: { default: string };
  enable_kvm: { default: string };
  set_as_trusted_user: { default: string };
}>('cachix/install-nix-action@v31');
