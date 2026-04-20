import type { Construct } from 'constructs';
import { dedent } from 'ts-dedent';

import { checkoutV4 } from '#src/actions.ts';
import { always, expr, github, secrets } from '#src/expressions.ts';
import { Job, type JobProps, type MatrixDefinition } from '#src/job.ts';
import { RunnerLabel } from '#src/nominal.ts';
import { Stack } from '#src/stack.ts';
import { Workflow } from '#src/workflow.ts';

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
    const token = config.pushUpdatedManifests ? secrets.CDKACTIONS_TOKEN : github.token;
    const synth = new Workflow(this, 'validate', {
      name: 'Validate cdkactions manifests',
      on: 'push',
    });
    new Job(synth, 'validate', {
      name: 'Validate cdkactions manifests',
      runsOn: RunnerLabel.UBUNTU_LATEST,
      steps: [
        checkoutV4({ with: { token } }),
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
          if: config.pushUpdatedManifests ? always() : expr<boolean>('false'),
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
    const { steps: configSteps, ...rest } = config;
    const co = checkoutV4();
    const steps: JobProps<TMatrix>['steps'] =
      typeof configSteps === 'function' ? (matrix) => [co, ...configSteps(matrix)] : [co, ...(configSteps || [])];
    super(scope, id, { ...rest, steps });
  }
}
