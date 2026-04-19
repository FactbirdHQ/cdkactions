import type { Construct } from 'constructs';
import { dedent } from 'ts-dedent';

import { checkoutV4 } from '#@/actions.js';
import { always } from '#@/expressions.js';
import { Condition, Job, type JobProps, type MatrixDefinition, type StepConfig } from '#@/job.js';
import { RunnerLabel } from '#@/nominal.js';
import { Stack } from '#@/stack.js';
import { Workflow } from '#@/workflow.js';

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
    const checkoutStep: StepConfig = checkoutV4();
    const steps: StepConfig[] = [checkoutStep, ...(config.steps || [])];
    super(scope, id, { ...config, steps });
  }
}
