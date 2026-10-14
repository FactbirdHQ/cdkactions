import * as fs from 'node:fs';

import { Construct, Node } from 'constructs';

import { PINNED_ACTION, type PinnedActionRef } from '#src/action.ts';
import { currentPinnedActionChecker } from '#src/action-pins.ts';
import { Job } from '#src/job.ts';
import { CDKActionsStack } from '#src/library.ts';
import { Stack } from '#src/stack.ts';
import { collectValidationErrors } from '#src/validation.ts';

/**
 * Configuration for a cdkactions app.
 */
export interface AppProps {
  /**
   * The directory to synthesize GitHub Action manifests in.
   *
   * @default - "../workflows"
   */
  readonly outdir?: string;

  /**
   * Create a validation workflow to ensure cdkactions manifests are up to date.
   * @default - true
   */
  readonly createValidateWorkflow?: boolean;

  /**
   * Push updated manifests if they are out of date. Only used if `createValidateWorkflow` is true.
   * @default - false
   */
  readonly pushUpdatedManifests?: boolean;
}

/**
 * Represents a cdkactions application.
 */
export class App extends Construct {
  /**
   * The directory to synthesize GitHub Action manifests in.
   */
  public readonly outdir: string;

  /**
   * Defines a cdkaction app.
   * @param options Configuration options.
   */
  constructor(options?: AppProps) {
    const config: AppProps = {
      createValidateWorkflow: true,
      pushUpdatedManifests: false,
      ...options,
    };

    super(undefined as any, '');
    this.outdir = config.outdir ?? '../workflows';
    if (config.createValidateWorkflow) {
      new CDKActionsStack(this, 'validate', {
        pushUpdatedManifests: config.pushUpdatedManifests,
      });
    }
  }

  /**
   * Synthesizes all manifests into the output directory.
   */
  public synth(): void {
    const errors = collectValidationErrors(this);
    if (errors.length > 0) {
      throw new Error(`Validation failed with ${errors.length} error(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }

    this.verifyPinnedActions();

    if (!fs.existsSync(this.outdir)) {
      fs.mkdirSync(this.outdir);
    }

    for (const child of Node.of(this).children) {
      if (child instanceof Stack) {
        child.synthesize(this.outdir);
      }
    }
  }

  /**
   * Requires every versioned pin's tag to point at its SHA. When GitHub cannot be reached, a local
   * synth warns and goes on, while one under GitHub Actions fails, since a runner without GitHub is
   * broken and CI must not skip the check.
   */
  private verifyPinnedActions(): void {
    const pins: PinnedActionRef[] = [];
    for (const construct of Node.of(this).findAll()) {
      if (!(construct instanceof Job)) continue;
      for (const step of construct.steps) {
        const pin: unknown = Reflect.get(step, PINNED_ACTION);
        if (isPinnedActionRef(pin)) pins.push(pin);
      }
    }
    if (pins.length === 0) return;

    const result = currentPinnedActionChecker()(pins);
    if (!result.reachable) {
      const unverified = result.unverified.map((pin) => `${pin.action}@${pin.sha} (${pin.version})`).join(', ');
      if (process.env.GITHUB_ACTIONS === 'true') {
        throw new Error(`GitHub is unreachable from this runner, so these pins cannot be verified: ${unverified}`);
      }
      console.warn(`WARNING: GitHub is unreachable, so these pins are unverified: ${unverified}`);
      return;
    }
    if (result.problems.length > 0) {
      throw new Error(
        `${result.problems.length} pinned action(s) failed verification:\n${result.problems.map((problem) => `  - ${problem.message}`).join('\n')}`,
      );
    }
  }
}

function isPinnedActionRef(value: unknown): value is PinnedActionRef {
  return typeof value === 'object' && value !== null && 'action' in value && 'sha' in value;
}
