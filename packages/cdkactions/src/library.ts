import type { Construct } from 'constructs';
import { dedent } from 'ts-dedent';

import { ActionRef } from '#@/action-ref.js';
import { always } from '#@/expressions.js';
import { Condition, Job, type JobProps, type MatrixDefinition, type StepConfig } from '#@/job.js';
import { RunnerLabel } from '#@/nominal.js';
import { Stack } from '#@/stack.js';
import { Workflow } from '#@/workflow.js';

export const checkoutV4 = ActionRef.fromReference<{
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
  setCacheUrl: { default: string };
  githubServerUrl: { default: string };
}>('actions/checkout@v4');

/**
 * Configuration for a CDKActionsStack instance.
 */
export interface CDKActionsProps {
  readonly pushUpdatedManifests?: boolean;
}

/**
 * Provided CDKActions Stack that configures a workflow to validate cdkactions
 */
export class CDKActionsStack extends Stack {
  public constructor(scope: Construct, id: string, config: CDKActionsProps) {
    super(scope, id);
    const token = config.pushUpdatedManifests ? 'secrets.CDKACTIONS_TOKEN' : 'github.token';
    const synth = new Workflow(this, 'validate', {
      name: 'Validate cdkactions manifests',
      on: 'push',
    });
    new Job(synth, 'validate', {
      name: 'Validate cdkactions manifests',
      runsOn: RunnerLabel.UBUNTU_LATEST,
      steps: [
        {
          uses: 'actions/checkout@v4',
          with: {
            token: `\${{ ${token} }}`,
          },
        },
        {
          name: 'Validate manifests',
          run: dedent`cd .github/cdk
                yarn install
                yarn build
                git --no-pager diff ../workflows
                git diff-index --quiet HEAD -- ../workflows`,
        },
        {
          name: 'Push updated manifests',
          if: config.pushUpdatedManifests ? always() : Condition.from('false'),
          run: dedent`cd .github/workflows
                git config user.name github-actions
                git config user.email github-actions[bot]@users.noreply.github.com
                git add .
                git commit -m "Update cdkactions manifests" || exit 0
                git push`,
        },
      ],
    });
  }
}

/**
 * A special Job that includes a checkout step automatically.
 */
export class CheckoutJob<TMatrix extends MatrixDefinition = MatrixDefinition> extends Job<TMatrix> {
  public constructor(scope: Workflow, id: string, config: JobProps<TMatrix>) {
    const steps: StepConfig[] = ([checkoutV4.call({})] as StepConfig[]).concat(config.steps || []);
    super(scope, id, { ...config, steps });
  }
}
