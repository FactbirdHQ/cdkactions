import { expr, type Expression } from '#@/expressions.js';
import type { UsesStep, StepBase } from '#@/job.js';
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

export interface TypedUsesStep<TOutputs extends ActionOutputs = ActionOutputs> extends Omit<UsesStep, 'run' | 'shell' | 'workingDirectory'> {
  output<K extends keyof TOutputs & string>(key: K): Expression<string>;
}

interface InternalCallInput extends StepBase {
  readonly id?: string;
  readonly with?: Record<string, string | number | boolean>;
}

export class Action<
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
  >(ref: string): Action<TInputs, TOutputs> {
    return new Action<TInputs, TOutputs>(ref);
  }

  public call(
    options: StepBase & ActionCallOptions<TInputs, TOutputs>,
  ): TypedUsesStep<TOutputs> {
    const { id: stepId, name, 'if': ifProp, env, continueOnError, timeoutMinutes, 'with': withProp } =
      options as InternalCallInput;

    const serializedWith = withProp
      ? Object.fromEntries(
          Object.entries(withProp).map(([k, v]) => [camelToKebab(k), v]),
        )
      : undefined;

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
        return expr<string>(`steps.${stepId}.outputs.${key}`);
      },
    };
    Object.defineProperty(step, 'output', { enumerable: false });

    return step;
  }
}

