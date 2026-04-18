import type { Expression } from '#@/expressions.js';
import type { StepBase } from '#@/job.js';
import { camelToKebab } from '#@/utils.js';

export interface ActionInput {
  readonly required?: boolean;
  readonly default?: string;
}

export type ActionInputs = Record<string, ActionInput>;

export type ActionOutputs = Record<string, { readonly description?: string }>;

type RequiredInputKeys<T extends ActionInputs> = {
  [K in keyof T & string]: T[K] extends { required: true } ? K
    : T[K] extends { default: string } ? never
    : K;
}[keyof T & string];

type OptionalInputKeys<T extends ActionInputs> = {
  [K in keyof T & string]: T[K] extends { required: true } ? never
    : T[K] extends { default: string } ? K
    : never;
}[keyof T & string];

type ActionWith<T extends ActionInputs> = {
  readonly [K in RequiredInputKeys<T>]: string | number | boolean;
} & {
  readonly [K in OptionalInputKeys<T>]?: string | number | boolean;
};

type ActionCallOptions<TInputs extends ActionInputs, TOutputs extends ActionOutputs> =
  & ([RequiredInputKeys<TInputs>] extends [never]
    ? { with?: ActionWith<TInputs> }
    : { with: ActionWith<TInputs> })
  & ([keyof TOutputs] extends [never]
    ? { id?: string }
    : { id: string });

export interface TypedUsesStep<TOutputs extends ActionOutputs = ActionOutputs> extends StepBase {
  readonly uses: string;
  readonly with?: Record<string, string | number | boolean>;

  output<K extends keyof TOutputs & string>(key: K): Expression<string>;
}

export class ActionRef<
  const TInputs extends ActionInputs = ActionInputs,
  const TOutputs extends ActionOutputs = ActionOutputs,
> {
  public readonly ref: string;

  private constructor(ref: string) {
    this.ref = ref;
  }

  static fromReference<
    TInputs extends ActionInputs = Record<never, never>,
    TOutputs extends ActionOutputs = Record<never, never>,
  >(ref: string): ActionRef<TInputs, TOutputs> {
    return new ActionRef<TInputs, TOutputs>(ref);
  }

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
    const step = {
      ...(stepId !== undefined && { id: stepId }),
      ...(name !== undefined && { name }),
      ...(ifProp !== undefined && { if: ifProp }),
      uses: this.ref,
      ...(serializedWith !== undefined && { with: serializedWith }),
      ...(env !== undefined && { env }),
      ...(continueOnError !== undefined && { continueOnError }),
      ...(timeoutMinutes !== undefined && { timeoutMinutes }),
    };
    Object.defineProperty(step, 'output', {
      value: <K extends keyof TOutputs & string>(key: K): Expression<string> => {
        if (!stepId) {
          throw new Error('Cannot access outputs on a step without an id');
        }
        return `steps.${stepId}.outputs.${key}` as Expression<string>;
      },
      enumerable: false,
    });

    return step as TypedUsesStep<TOutputs>;
  }
}
