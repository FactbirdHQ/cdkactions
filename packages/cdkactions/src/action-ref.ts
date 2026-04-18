/**
 * Typed references to external GitHub Actions.
 *
 * ActionRef captures an action's input/output schema at the type level,
 * enabling compile-time enforcement of required inputs, rejection of
 * unknown inputs, and typed output accessors.
 */

import type { Expression } from './expressions.js';
import { camelToKebab } from './utils.js';

// ─── Action Schema Types ────────────────────────────────────────────────────────

/**
 * Describes a single action input — whether it's required and/or has a default.
 */
export interface ActionInput {
  readonly required?: boolean;
  readonly default?: string;
}

/**
 * Map of input names to their schema.
 */
export type ActionInputs = Record<string, ActionInput>;

/**
 * Map of output names to their metadata.
 */
export type ActionOutputs = Record<string, { readonly description?: string }>;

// ─── Input Key Helpers ──────────────────────────────────────────────────────────

/**
 * Keys of inputs that are required:
 * - explicitly `{ required: true }`, OR
 * - have no `default` and no `required: true` (bare `{}` means required)
 */
type RequiredInputKeys<T extends ActionInputs> = {
  [K in keyof T & string]: T[K] extends { required: true } ? K
    : T[K] extends { default: string } ? never
    : K;
}[keyof T & string];

/**
 * Keys of inputs that are optional (have a default value).
 */
type OptionalInputKeys<T extends ActionInputs> = {
  [K in keyof T & string]: T[K] extends { required: true } ? never
    : T[K] extends { default: string } ? K
    : never;
}[keyof T & string];

/**
 * The `with` object shape derived from the action's input schema.
 * Required inputs are mandatory; inputs with defaults are optional.
 */
type ActionWith<T extends ActionInputs> = {
  readonly [K in RequiredInputKeys<T>]: string | number | boolean;
} & {
  readonly [K in OptionalInputKeys<T>]?: string | number | boolean;
};

// ─── Call Options ───────────────────────────────────────────────────────────────

/**
 * Step-level properties that can be set when calling an action.
 */
export interface StepBase {
  readonly name?: string;
  readonly if?: string;
  readonly env?: Record<string, string>;
  readonly continueOnError?: boolean;
  readonly timeoutMinutes?: number;
}

type ActionCallOptions<TInputs extends ActionInputs, TOutputs extends ActionOutputs> =
  & ([RequiredInputKeys<TInputs>] extends [never]
    ? { with?: ActionWith<TInputs> }
    : { with: ActionWith<TInputs> })
  & ([keyof TOutputs] extends [never]
    ? { id?: string }
    : { id: string });

// ─── TypedUsesStep ──────────────────────────────────────────────────────────────

/**
 * A uses-step with typed output accessors.
 * Extends the plain UsesStep shape so it can be used anywhere StepConfig is accepted.
 */
export interface TypedUsesStep<TOutputs extends ActionOutputs = ActionOutputs> {
  readonly id?: string;
  readonly name?: string;
  readonly if?: string;
  readonly uses: string;
  readonly with?: Record<string, string | number | boolean>;
  readonly env?: Record<string, string>;
  readonly continueOnError?: boolean;
  readonly timeoutMinutes?: number;

  /**
   * Reference an output of this step.
   * Returns an Expression<string> of the form `steps.<id>.outputs.<key>`.
   */
  output<K extends keyof TOutputs & string>(key: K): Expression<string>;
}

// ─── ActionRef ──────────────────────────────────────────────────────────────────

/**
 * A typed reference to an external GitHub Action.
 * TInputs captures the action's input schema; TOutputs captures its output schema.
 */
export class ActionRef<
  const TInputs extends ActionInputs = ActionInputs,
  const TOutputs extends ActionOutputs = ActionOutputs,
> {
  public readonly ref: string;

  private constructor(ref: string) {
    this.ref = ref;
  }

  /**
   * Define a typed action reference.
   *
   * @example
   * const checkoutV4 = ActionRef.fromReference<{
   *   repository: { default: '${{ github.repository }}' };
   *   ref: {};
   *   token: { default: '${{ github.token }}' };
   * }, {
   *   ref: {};
   *   commit: {};
   * }>('actions/checkout@v4');
   */
  static fromReference<
    TInputs extends ActionInputs = Record<never, never>,
    TOutputs extends ActionOutputs = Record<never, never>,
  >(ref: string): ActionRef<TInputs, TOutputs> {
    return new ActionRef<TInputs, TOutputs>(ref);
  }

  /**
   * Create a step that uses this action.
   * Required inputs must be provided; inputs with defaults are optional.
   * Unknown inputs are compile errors (via excess property checks).
   *
   * When TOutputs is non-empty, `id` is required so outputs can be referenced
   * via `${{ steps.<id>.outputs.<key> }}`.
   */
  public call(
    options: StepBase & ActionCallOptions<TInputs, TOutputs>,
  ): TypedUsesStep<TOutputs> {
    const { id, name, env, continueOnError, timeoutMinutes } = options as StepBase & { id?: string };
    const ifProp = (options as StepBase)['if'];
    const withProp = (options as { with?: Record<string, string | number | boolean> }).with;

    // Convert camelCase input keys to kebab-case for GitHub Actions
    const serializedWith = withProp
      ? Object.fromEntries(
          Object.entries(withProp).map(([k, v]) => [camelToKebab(k), v]),
        )
      : undefined;

    const stepId = id;
    const step: TypedUsesStep<TOutputs> = {
      ...(stepId !== undefined && { id: stepId }),
      ...(name !== undefined && { name }),
      ...(ifProp !== undefined && { if: ifProp }),
      uses: this.ref,
      ...(serializedWith !== undefined && { with: serializedWith }),
      ...(env !== undefined && { env }),
      ...(continueOnError !== undefined && { continueOnError }),
      ...(timeoutMinutes !== undefined && { timeoutMinutes }),
      output<K extends keyof TOutputs & string>(key: K): Expression<string> {
        if (!stepId) {
          throw new Error('Cannot access outputs on a step without an id');
        }
        return `steps.${stepId}.outputs.${key}` as Expression<string>;
      },
    };

    return step;
  }
}
