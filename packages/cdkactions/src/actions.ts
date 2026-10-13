import { defineAction } from '#src/action.ts';

export const checkoutV2 = defineAction<{
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

export const checkoutV3 = defineAction<{
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

export const checkoutV4 = defineAction<{
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

export const uploadArtifactV1 = defineAction<
  {
    name: { required: true };
    path: { required: true };
  },
  {
    artifactId: {};
  }
>('actions/upload-artifact@v1');

export const uploadArtifactV2 = defineAction<
  {
    name: { required: true };
    path: { required: true };
    ifNoFilesFound: { default: string };
    retentionDays: { default: string };
  },
  {
    artifactId: {};
  }
>('actions/upload-artifact@v2');

export const uploadArtifactV3 = defineAction<
  {
    name: { required: true };
    path: { required: true };
    ifNoFilesFound: { default: string };
    retentionDays: { default: string };
  },
  {
    artifactId: {};
  }
>('actions/upload-artifact@v3');

export const uploadArtifactV4 = defineAction<
  {
    name: { required: true };
    path: { required: true };
    ifNoFilesFound: { default: string };
    retentionDays: { default: string };
    compressionLevel: { default: string };
    overwrite: { default: string };
    includeHiddenFiles: { default: string };
  },
  {
    artifactId: {};
    artifactUrl: {};
  }
>('actions/upload-artifact@v4');

export const downloadArtifactV1 = defineAction<{
  name: { default: string };
  path: { default: string };
}>('actions/download-artifact@v1');

export const downloadArtifactV2 = defineAction<{
  name: { default: string };
  path: { default: string };
}>('actions/download-artifact@v2');

export const downloadArtifactV3 = defineAction<{
  name: { default: string };
  path: { default: string };
}>('actions/download-artifact@v3');

export const downloadArtifactV4 = defineAction<
  {
    name: { default: string };
    path: { default: string };
    pattern: { default: string };
    mergeMultiple: { default: string };
    githubToken: { default: string };
    repository: { default: string };
    runId: { default: string };
  },
  {
    downloadPath: {};
  }
>('actions/download-artifact@v4');

export const cacheV4 = defineAction<
  {
    path: { required: true };
    key: { required: true };
    restoreKeys: { default: string };
    uploadChunkSize: { default: string };
    enableCrossOsArchive: { default: string };
    failOnCacheMiss: { default: string };
    lookupOnly: { default: string };
    saveAlways: { default: string };
  },
  {
    'cache-hit': { description: string };
  }
>('actions/cache@v4', { verbatimInputs: ['enableCrossOsArchive'] });

export const setupNodeV6 = defineAction<
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

export const setupGoV6 = defineAction<
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

export const setupJavaV5 = defineAction<
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

export const setupPythonV6 = defineAction<
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

export const setupRubyV1 = defineAction<
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

export const createGithubAppTokenV3 = defineAction<
  {
    clientId: { default: string };
    appId: { default: string };
    privateKey: { required: true };
    owner: { default: string };
    repositories: { default: string };
    enterprise: { default: string };
    skipTokenRevoke: { default: string };
    githubApiUrl: { default: string };
    permissionActions: { default: string };
    permissionAdministration: { default: string };
    permissionArtifactMetadata: { default: string };
    permissionAttestations: { default: string };
    permissionChecks: { default: string };
    permissionCodeQuality: { default: string };
    permissionCodespaces: { default: string };
    permissionContents: { default: string };
    permissionCustomPropertiesForOrganizations: { default: string };
    permissionDependabotSecrets: { default: string };
    permissionDeployments: { default: string };
    permissionDiscussions: { default: string };
    permissionEmailAddresses: { default: string };
    permissionEnterpriseCustomPropertiesForOrganizations: { default: string };
    permissionEnvironments: { default: string };
    permissionFollowers: { default: string };
    permissionGitSshKeys: { default: string };
    permissionGpgKeys: { default: string };
    permissionInteractionLimits: { default: string };
    permissionIssues: { default: string };
    permissionMembers: { default: string };
    permissionMergeQueues: { default: string };
    permissionMetadata: { default: string };
    permissionOrganizationAdministration: { default: string };
    permissionOrganizationAnnouncementBanners: { default: string };
    permissionOrganizationCopilotAgentSettings: { default: string };
    permissionOrganizationCopilotSeatManagement: { default: string };
    permissionOrganizationCustomOrgRoles: { default: string };
    permissionOrganizationCustomProperties: { default: string };
    permissionOrganizationCustomRoles: { default: string };
    permissionOrganizationEvents: { default: string };
    permissionOrganizationExternalPropertiesForRepos: { default: string };
    permissionOrganizationHooks: { default: string };
    permissionOrganizationPackages: { default: string };
    permissionOrganizationPersonalAccessTokenRequests: { default: string };
    permissionOrganizationPersonalAccessTokens: { default: string };
    permissionOrganizationPlan: { default: string };
    permissionOrganizationProjects: { default: string };
    permissionOrganizationSecrets: { default: string };
    permissionOrganizationSelfHostedRunners: { default: string };
    permissionOrganizationUserBlocking: { default: string };
    permissionPackages: { default: string };
    permissionPages: { default: string };
    permissionProfile: { default: string };
    permissionPullRequests: { default: string };
    permissionRepositoryCustomProperties: { default: string };
    permissionRepositoryHooks: { default: string };
    permissionRepositoryProjects: { default: string };
    permissionSecretScanningAlerts: { default: string };
    permissionSecrets: { default: string };
    permissionSecurityEvents: { default: string };
    permissionSingleFile: { default: string };
    permissionStarring: { default: string };
    permissionStatuses: { default: string };
    permissionVulnerabilityAlerts: { default: string };
    permissionWorkflows: { default: string };
  },
  {
    token: { description: string };
    'installation-id': { description: string };
    'app-slug': { description: string };
  }
>('actions/create-github-app-token@v3');

export const githubScriptV9 = defineAction<
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

export const addToProjectV1 = defineAction<
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

export const publishImmutableActionV1 = defineAction<
  {
    githubToken: { default: string };
  },
  {
    packageManifestSha: { description: string };
    attestationManifestSha: { description: string };
    referrerIndexManifestSha: { description: string };
  }
>('actions/publish-immutable-action@v1');

export const uploadReleaseAssetV1 = defineAction<
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

export const createReleaseV1 = defineAction<
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

export const determinateNixV3 = defineAction<{
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
  sourceChecksumsUrl: { default: string };
  sourceChecksumsSha256: { default: string };
  backtrace: { default: string };
  diagnosticEndpoint: { default: string };
  logDirectives: { default: string };
  logger: { default: string };
  _internalStrictMode: { default: string };
}>('DeterminateSystems/determinate-nix-action@v3');

export const installNixActionV31 = defineAction<{
  extra_nix_config: { default: string };
  github_access_token: { default: string };
  install_url: { default: string };
  install_options: { default: string };
  nix_path: { default: string };
  enable_kvm: { default: string };
  set_as_trusted_user: { default: string };
}>('cachix/install-nix-action@v31');

export const checkoutV7 = defineAction<
  {
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
    allowUnsafePrCheckout: { default: string };
  },
  {
    ref: { description: string };
    commit: { description: string };
  }
>('actions/checkout@v7');

export const nixInstallerActionV23 = defineAction<{
  backtrace: { default: string };
  determinate: { default: string };
  extraArgs: { default: string };
  extraConf: { default: string };
  flakehub: { default: string };
  forceNoSystemd: { default: string };
  githubToken: { default: string };
  githubServerUrl: { default: string };
  init: { default: string };
  jobStatus: { default: string };
  kvm: { default: string };
  localRoot: { default: string };
  logDirectives: { default: string };
  logger: { default: string };
  sslCertFile: { default: string };
  proxy: { default: string };
  macCaseSensitive: { default: string };
  macEncrypt: { default: string };
  macRootDisk: { default: string };
  macVolumeLabel: { default: string };
  modifyProfile: { default: string };
  nixBuildGroupId: { default: string };
  nixBuildGroupName: { default: string };
  nixBuildUserBase: { default: string };
  nixBuildUserCount: { default: string };
  nixBuildUserPrefix: { default: string };
  sourceBinary: { default: string };
  sourceBranch: { default: string };
  sourcePr: { default: string };
  sourceRevision: { default: string };
  sourceTag: { default: string };
  sourceUrl: { default: string };
  sourceChecksumsUrl: { default: string };
  sourceChecksumsSha256: { default: string };
  nixPackageUrl: { default: string };
  planner: { default: string };
  reinstall: { default: string };
  startDaemon: { default: string };
  diagnosticEndpoint: { default: string };
  trustRunnerUser: { default: string };
  summarize: { default: string };
  nixInstallerBranch: { default: string };
  nixInstallerPr: { default: string };
  nixInstallerRevision: { default: string };
  nixInstallerTag: { default: string };
  nixInstallerUrl: { default: string };
  _internalStrictMode: { default: string };
}>('DeterminateSystems/nix-installer-action@v23');

export const updateFlakeLockV29 = defineAction<
  {
    inputs: { default: string };
    token: { default: string };
    commitMsg: { default: string };
    base: { default: string };
    branch: { default: string };
    pushToFork: { default: string };
    pathToFlakeDir: { default: string };
    prTitle: { default: string };
    prBody: { default: string };
    prLabels: { default: string };
    prAssignees: { default: string };
    prReviewers: { default: string };
    gitAuthorName: { default: string };
    gitAuthorEmail: { default: string };
    gitCommitterName: { default: string };
    gitCommitterEmail: { default: string };
    signCommits: { default: string };
    gpgPrivateKey: { default: string };
    gpgFingerprint: { default: string };
    gpgPassphrase: { default: string };
    nixOptions: { default: string };
    _internalStrictMode: { default: string };
  },
  {
    'pull-request-number': { description: string };
    'pull-request-url': { description: string };
    'pull-request-operation': { description: string };
  }
>('DeterminateSystems/update-flake-lock@v29');

export const createPullRequestV8 = defineAction<
  {
    token: { default: string };
    branchToken: { default: string };
    path: { default: string };
    addPaths: { default: string };
    commitMessage: { default: string };
    committer: { default: string };
    author: { default: string };
    signoff: { default: string };
    branch: { default: string };
    deleteBranch: { default: string };
    branchSuffix: { default: string };
    base: { default: string };
    pushToFork: { default: string };
    signCommits: { default: string };
    title: { default: string };
    body: { default: string };
    bodyPath: { default: string };
    labels: { default: string };
    assignees: { default: string };
    reviewers: { default: string };
    teamReviewers: { default: string };
    milestone: { default: string };
    draft: { default: string };
    maintainerCanModify: { default: string };
  },
  {
    'pull-request-number': { description: string };
    'pull-request-url': { description: string };
    'pull-request-operation': { description: string };
    'pull-request-head-sha': { description: string };
    'pull-request-branch': { description: string };
  }
>('peter-evans/create-pull-request@v8');

export const cachixActionV16 = defineAction<{
  name: { required: true };
  extraPullNames: { default: string };
  authToken: { default: string };
  signingKey: { default: string };
  skipPush: { default: string };
  useDaemon: { default: string };
  pathsToPush: { default: string };
  pushFilter: { default: string };
  skipAddingSubstituter: { default: string };
  cachixArgs: { default: string };
  cachixBin: { default: string };
  installCommand: { default: string };
}>('cachix/cachix-action@v16', {
  verbatimInputs: [
    'extraPullNames',
    'authToken',
    'signingKey',
    'skipPush',
    'useDaemon',
    'pathsToPush',
    'pushFilter',
    'skipAddingSubstituter',
    'cachixArgs',
    'cachixBin',
    'installCommand',
  ],
});

export const configureAwsCredentialsV6 = defineAction<
  {
    awsRegion: { required: true };
    awsProfile: { default: string };
    overwriteAwsProfile: { default: string };
    roleToAssume: { default: string };
    awsAccessKeyId: { default: string };
    awsSecretAccessKey: { default: string };
    awsSessionToken: { default: string };
    webIdentityTokenFile: { default: string };
    roleChaining: { default: string };
    audience: { default: string };
    httpProxy: { default: string };
    noProxy: { default: string };
    maskAwsAccountId: { default: string };
    roleDurationSeconds: { default: string };
    roleExternalId: { default: string };
    roleSessionName: { default: string };
    roleSkipSessionTagging: { default: string };
    transitiveTagKeys: { default: string };
    inlineSessionPolicy: { default: string };
    managedSessionPolicies: { default: string };
    outputCredentials: { default: string };
    outputEnvCredentials: { default: string };
    unsetCurrentCredentials: { default: string };
    disableRetry: { default: string };
    retryMaxAttempts: { default: string };
    specialCharactersWorkaround: { default: string };
    useExistingCredentials: { default: string };
    allowedAccountIds: { default: string };
    forceSkipOidc: { default: string };
    actionTimeoutS: { default: string };
    customTags: { default: string };
    stsEndpoint: { default: string };
    translateEnvVariables: { default: string };
  },
  {
    'aws-account-id': { description: string };
    'aws-access-key-id': { description: string };
    'aws-secret-access-key': { description: string };
    'aws-session-token': { description: string };
    'aws-expiration': { description: string };
  }
>('aws-actions/configure-aws-credentials@v6');

export const setupBunV2 = defineAction<
  {
    bunVersion: { default: string };
    bunVersionFile: { default: string };
    bunDownloadUrl: { default: string };
    registries: { default: string };
    registryUrl: { default: string };
    scope: { default: string };
    noCache: { default: string };
    token: { default: string };
  },
  {
    'bun-version': { description: string };
    'bun-revision': { description: string };
    'bun-path': { description: string };
    'bun-download-url': { description: string };
    'cache-hit': { description: string };
  }
>('oven-sh/setup-bun@v2');

export const uploadArtifactV7 = defineAction<
  {
    name: { default: string };
    path: { required: true };
    ifNoFilesFound: { default: string };
    retentionDays: { default: string };
    compressionLevel: { default: string };
    overwrite: { default: string };
    includeHiddenFiles: { default: string };
    archive: { default: string };
  },
  {
    'artifact-id': { description: string };
    'artifact-url': { description: string };
    'artifact-digest': { description: string };
  }
>('actions/upload-artifact@v7');

export const downloadArtifactV8 = defineAction<
  {
    name: { default: string };
    artifactIds: { default: string };
    path: { default: string };
    pattern: { default: string };
    mergeMultiple: { default: string };
    githubToken: { default: string };
    repository: { default: string };
    runId: { default: string };
    skipDecompress: { default: string };
    digestMismatch: { default: string };
  },
  {
    'download-path': { description: string };
  }
>('actions/download-artifact@v8');
