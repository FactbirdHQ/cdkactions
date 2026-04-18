import type { Construct } from 'constructs';

import type { Expression } from './expressions.js';
import type { Condition, StepConfig, UsesStep } from './job.js';
import { Stack } from './stack.js';
import type { StringMap } from './types.js';
import { renameKeys } from './utils.js';

/**
 * Configuration for a composite action input.
 */
export interface CompositeActionInputProps {
  /**
   * A description of the input.
   */
  readonly description: string;

  /**
   * Whether the input is required.
   */
  readonly required?: boolean;

  /**
   * The default value for the input.
   */
  readonly default?: string;
}

/**
 * Configuration for a composite action output.
 */
export interface CompositeActionOutputProps {
  /**
   * A description of the output.
   */
  readonly description: string;

  /**
   * The value of the output, typically a context expression like
   * `${{ steps.step-id.outputs.field }}`.
   */
  readonly value: string;
}

/**
 * Configuration for a GitHub composite action.
 */
export interface CompositeActionProps<TInputs extends Record<string, CompositeActionInputProps>, TOutputs extends Record<string, CompositeActionOutputProps> = Record<never, never>> {
  /**
   * Name of the composite action.
   */
  readonly name: string;

  /**
   * Description of the composite action.
   */
  readonly description: string;

  /**
   * Input parameters for the composite action.
   */
  readonly inputs?: TInputs;

  /**
   * Output parameters for the composite action.
   */
  readonly outputs?: TOutputs;

  /**
   * Steps to run in the composite action.
   */
  readonly steps: StepConfig[];
}

type RequiredInputKeys<T extends Record<string, CompositeActionInputProps>> = {
  [K in keyof T & string]: T[K] extends { required: true } ? K : never;
}[keyof T & string];

type OptionalInputKeys<T extends Record<string, CompositeActionInputProps>> = {
  [K in keyof T & string]: T[K] extends { required: true } ? never : K;
}[keyof T & string];

type CompositeActionWith<T extends Record<string, CompositeActionInputProps>> = {
  readonly [K in RequiredInputKeys<T>]: string | number | boolean;
} & {
  readonly [K in OptionalInputKeys<T>]?: string | number | boolean;
};

type AsStepOptions<T extends Record<string, CompositeActionInputProps>, TOutputs extends Record<string, CompositeActionOutputProps> = Record<never, never>> = {
  env?: StringMap;
  name?: string;
  if?: Condition | Expression<boolean>;
} & ([keyof TOutputs] extends [never] ? { id?: string } : { id: string }) & ([RequiredInputKeys<T>] extends [never] ? { with?: CompositeActionWith<T> } : { with: CompositeActionWith<T> });

type CompositeActionStepRef<TOutputs extends Record<string, CompositeActionOutputProps>> = UsesStep & {
  output<K extends keyof TOutputs & string>(key: K): string;
};

/**
 * Represents a GitHub composite action that produces an action.yml file.
 *
 * Composite actions are created in global scope and registered with a stack
 * via `asStep()`, ensuring the action.yml is rendered once regardless of
 * how many workflows reference it.
 *
 * @typeParam TInputs - The shape of the action's inputs, inferred from the constructor.
 */
export class CompositeAction<const TInputs extends Record<string, CompositeActionInputProps> = Record<never, never>, const TOutputs extends Record<string, CompositeActionOutputProps> = Record<never, never>> {
  /**
   * Directory name for this composite action under .github/actions/.
   */
  public readonly actionDirectory: string;

  private readonly config: CompositeActionProps<TInputs, TOutputs>;

  public constructor(id: string, config: CompositeActionProps<TInputs, TOutputs>) {
    this.actionDirectory = id;
    this.config = config;
  }

  /**
   * Returns the `uses` path for referencing this composite action from a workflow step.
   */
  public get usesPath(): string {
    return `./.github/actions/${this.actionDirectory}`;
  }

  /**
   * Creates a step configuration that references this composite action
   * and registers it with the enclosing stack for synthesis.
   * @param scope Any construct in the tree — the owning Stack is resolved automatically.
   */
  public asStep(
    scope: Construct,
    ...args: [RequiredInputKeys<TInputs>] extends [never]
      ? [options?: AsStepOptions<TInputs, TOutputs>]
      : [options: AsStepOptions<TInputs, TOutputs>]
  ): CompositeActionStepRef<TOutputs> {
    Stack.of(scope).registerCompositeAction(this);

    const options = args[0];
    const id = options?.id;

    const step: UsesStep = {
      name: this.config.name,
      ...options,
      uses: this.usesPath,
    };
    Object.defineProperty(step, 'output', {
      value: (key: string) => `\${{ steps.${id}.outputs.${key} }}`,
      enumerable: false,
    });

    return step as CompositeActionStepRef<TOutputs>;
  }

  /**
   * Converts the composite action configuration into a GitHub Actions compatible action.yml structure.
   */
  public toGHAction(): Record<string, unknown> {
    const action: Record<string, unknown> = {
      name: this.config.name,
      description: this.config.description,
    };

    if (this.config.inputs) {
      action.inputs = this.config.inputs;
    }

    if (this.config.outputs) {
      action.outputs = this.config.outputs;
    }

    action.runs = {
      using: 'composite',
      steps: this.config.steps.map((step) =>
        renameKeys(step, {
          continueOnError: 'continue-on-error',
          timeoutMinutes: 'timeout-minutes',
          workingDirectory: 'working-directory',
        }),
      ),
    };

    return action;
  }
}
