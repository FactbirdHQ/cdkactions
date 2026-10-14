import { expr, type Expression, type AnyExpression } from '#src/expressions.ts';
import type { UsesStep, StepBase } from '#src/job.ts';
import { camelToKebab } from '#src/utils.ts';

export interface ActionInput {
  readonly required?: boolean;
  readonly default?: string;
}

export type ActionInputs = Record<string, ActionInput>;

export type ActionOutputs = Record<string, { readonly description?: string }>;

type RequiredInputKeys<T extends ActionInputs> = {
  [K in keyof T & string]: T[K] extends { required: true } ? K : T[K] extends { default: string } ? never : K;
}[keyof T & string];

type OptionalInputKeys<T extends ActionInputs> = {
  [K in keyof T & string]: T[K] extends { required: true } ? never : T[K] extends { default: string } ? K : never;
}[keyof T & string];

type ActionInputValue = string | number | boolean | AnyExpression;

type ActionWith<T extends ActionInputs> = {
  readonly [K in RequiredInputKeys<T>]: ActionInputValue;
} & {
  readonly [K in OptionalInputKeys<T>]?: ActionInputValue;
};

type ActionCallOptions<TInputs extends ActionInputs, TOutputs extends ActionOutputs> = ([
  RequiredInputKeys<TInputs>,
] extends [never]
  ? { with?: ActionWith<TInputs> }
  : { with: ActionWith<TInputs> }) &
  ([keyof TOutputs] extends [never] ? { id?: string } : { id: string });

export interface TypedUsesStep<TOutputs extends ActionOutputs = ActionOutputs>
  extends Omit<UsesStep, 'run' | 'shell' | 'workingDirectory'> {
  readonly outputs: { readonly [K in keyof TOutputs & string]: Expression<string> };
}

type HasRequiredCallOptions<TInputs extends ActionInputs, TOutputs extends ActionOutputs> = [
  RequiredInputKeys<TInputs>,
] extends [never]
  ? [keyof TOutputs] extends [never]
    ? false
    : true
  : true;

/**
 * The commit an action runs at, and the release tag that points at that commit.
 */
export interface ActionPin {
  readonly sha: string;
  readonly version: string;
}

export interface ActionMembers<TInputs extends ActionInputs, TOutputs extends ActionOutputs> {
  readonly ref: string;
  readonly uses: string;
  readonly pin?: ActionPin;
  /**
   * The same action at an exact commit, so its steps use `<action>@<sha>`. `version` names the
   * release tag at that commit and never reaches the YAML.
   */
  pinned(sha: string, version: string): Action<TInputs, TOutputs>;
}

export type Action<
  TInputs extends ActionInputs = Record<never, never>,
  TOutputs extends ActionOutputs = Record<never, never>,
> =
  HasRequiredCallOptions<TInputs, TOutputs> extends true
    ? ((options: StepBase & ActionCallOptions<TInputs, TOutputs>) => TypedUsesStep<TOutputs>) &
        ActionMembers<TInputs, TOutputs>
    : ((options?: StepBase & ActionCallOptions<TInputs, TOutputs>) => TypedUsesStep<TOutputs>) &
        ActionMembers<TInputs, TOutputs>;

export interface DefineActionOptions {
  /**
   * Inputs whose `action.yml` name is not kebab-case, such as `enableCrossOsArchive`. These keys
   * reach the YAML as written.
   */
  readonly verbatimInputs?: readonly string[];
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const MAJOR_REF = /@v(\d+)$/;
const VERSION_MAJOR = /^v?(\d+)(?:\.|$)/;

export function defineAction<
  TInputs extends ActionInputs = Record<never, never>,
  TOutputs extends ActionOutputs = Record<never, never>,
>(ref: string, definition: DefineActionOptions = {}): Action<TInputs, TOutputs> {
  return defineActionAt<TInputs, TOutputs>(ref, definition);
}

function defineActionAt<TInputs extends ActionInputs, TOutputs extends ActionOutputs>(
  ref: string,
  definition: DefineActionOptions,
  pin?: ActionPin,
): Action<TInputs, TOutputs> {
  const verbatimInputs = new Set(definition.verbatimInputs ?? []);
  const uses = pin ? `${ref.slice(0, ref.lastIndexOf('@'))}@${pin.sha}` : ref;

  const fn = (options?: StepBase & ActionCallOptions<TInputs, TOutputs>) => {
    const { id: stepId, name, if: ifProp, env, continueOnError, timeoutMinutes, with: withProp } = options ?? {};

    const serializedWith = withProp
      ? Object.fromEntries(
          Object.entries<ActionInputValue>(withProp).map(([k, v]) => [verbatimInputs.has(k) ? k : camelToKebab(k), v]),
        )
      : undefined;

    const outputs = new Proxy({} as TypedUsesStep<TOutputs>['outputs'], {
      get(_target, prop: string | symbol): unknown {
        if (typeof prop === 'symbol') return undefined;
        if (!stepId) {
          throw new Error('Cannot access outputs on a step without an id');
        }
        return expr<string>(`steps.${stepId}.outputs.${prop}`);
      },
    });

    const step: TypedUsesStep<TOutputs> = {
      ...(stepId !== undefined && { id: stepId }),
      ...(name !== undefined && { name }),
      ...(ifProp !== undefined && { if: ifProp }),
      uses,
      ...(serializedWith !== undefined && { with: serializedWith }),
      ...(env !== undefined && { env }),
      ...(continueOnError !== undefined && { continueOnError }),
      ...(timeoutMinutes !== undefined && { timeoutMinutes }),
      outputs,
    };
    Object.defineProperty(step, 'outputs', { enumerable: false });

    return step;
  };

  const pinned = (sha: string, version: string): Action<TInputs, TOutputs> => {
    if (!COMMIT_SHA.test(sha)) {
      throw new Error(`${ref}: pinned() takes a 40-character lowercase hex commit SHA, got '${sha}'`);
    }
    if (version.trim() === '') {
      throw new Error(`${ref}: pinned() takes the release tag at ${sha} as its version`);
    }
    const refMajor = MAJOR_REF.exec(ref)?.[1];
    if (refMajor !== undefined && VERSION_MAJOR.exec(version)?.[1] !== refMajor) {
      throw new Error(`${ref}: pinned() was given version '${version}', which is not a v${refMajor} release`);
    }
    return defineActionAt<TInputs, TOutputs>(ref, definition, { sha, version });
  };

  return Object.assign(fn, { ref, uses, pinned, ...(pin !== undefined && { pin }) });
}
