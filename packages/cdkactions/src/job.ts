import { Construct } from 'constructs';

import { and, expr, type Expression, github, type GitHubContextFor } from '#src/expressions.ts';
import type { RunnerLabel, Shell } from '#src/nominal.ts';
import type { DefaultsProps, StringMap } from '#src/types.ts';
import { renameKeys, type Writable } from '#src/utils.ts';
import { addJobValidation } from '#src/validation.ts';
import type { Permissions, Workflow, WorkflowTrigger } from '#src/workflow.ts';

/**
 * Credentials to connect to a Docker registry with.
 */
export interface CredentialsProps {
  readonly username: string;
  readonly password: string;
}

/**
 * Generic Docker configuration.
 */
export interface DockerProps {
  readonly image: string;
  readonly credentials?: CredentialsProps;
  readonly env?: StringMap;
  readonly ports?: string[];
  readonly volumes?: string[];
  readonly options?: string;
}

export interface ServiceProps extends DockerProps {
  readonly command?: string;
  readonly entrypoint?: string;
}

export type EnvironmentConfig = string | { readonly name: string; readonly url?: string };

export type ConcurrencyConfig = string | { readonly group: string; readonly cancelInProgress?: boolean };

export interface RunnerGroupConfig {
  readonly group: string;
  readonly labels?: RunnerLabel[];
}

export type IfCondition<TOn = unknown> = Expression<boolean> | ((github: GitHubContextFor<TOn>) => Expression<boolean>);

export interface StepBase<TOn = unknown> {
  readonly id?: string;
  readonly name?: string;
  readonly if?: IfCondition<TOn>;
  readonly env?: StringMap;
  readonly continueOnError?: boolean;
  readonly timeoutMinutes?: number;
}

export interface RunStep<TOn = unknown> extends StepBase<TOn> {
  readonly run: string;
  readonly shell?: Shell;
  readonly workingDirectory?: string;
  readonly uses?: never;
  readonly with?: never;
}

export interface UsesStep<TOn = unknown> extends StepBase<TOn> {
  readonly uses: string;
  readonly with?: { [key: string]: string | number | boolean };
  readonly run?: never;
  readonly shell?: never;
  readonly workingDirectory?: never;
}

export type StepConfig<TOn = unknown> = RunStep<TOn> | UsesStep<TOn>;

/** @deprecated Use StepConfig instead. */
export type StepsProps = StepConfig;

export interface StepRef {
  output(key: string): Expression<string>;
}

/**
 * Wraps a step config with an `output()` method for type-safe step output references.
 * The step must have an `id` so that outputs can be resolved via `steps.<id>.outputs.<key>`.
 */
export function step<T extends StepConfig<any> & { readonly id: string }>(config: T): T & StepRef {
  const ref: T & StepRef = {
    ...config,
    output(key: string): Expression<string> {
      return expr<string>(`steps.${config.id}.outputs.${key}`);
    },
  };
  Object.defineProperty(ref, 'output', { enumerable: false });
  return ref;
}

export type MatrixDefinition = Record<string, ReadonlyArray<string | number | boolean>>;

type MatrixEntry<TMatrix extends MatrixDefinition> = Partial<{
  [K in keyof TMatrix]: TMatrix[K][number];
}>;

export interface StrategyProps<TMatrix extends MatrixDefinition = MatrixDefinition> {
  readonly matrix?: TMatrix;
  readonly include?: Array<MatrixEntry<TMatrix>>;
  readonly exclude?: Array<MatrixEntry<TMatrix>>;
  readonly failFast?: boolean;
  readonly maxParallel?: number;
}

type MatrixProxy<TMatrix extends MatrixDefinition> = {
  readonly [K in keyof TMatrix]: Expression<TMatrix[K][number]>;
};

export function createMatrixProxy<TMatrix extends MatrixDefinition>(_matrix: TMatrix): MatrixProxy<TMatrix> {
  return new Proxy({} as MatrixProxy<TMatrix>, {
    get(_target, prop: string) {
      return expr(`matrix.${prop}`);
    },
  });
}

/**
 * Configuration for a single GitHub Action job.
 */
export interface JobProps<TMatrix extends MatrixDefinition = MatrixDefinition, TOn extends WorkflowTrigger = WorkflowTrigger> {
  readonly name?: string;
  readonly needs?: string | string[];
  readonly runsOn?: RunnerLabel | RunnerLabel[] | RunnerGroupConfig | Expression<string>;
  readonly outputs?: StringMap;
  readonly env?: StringMap;
  readonly defaults?: DefaultsProps;
  readonly if?: IfCondition<TOn>;
  readonly steps?: StepConfig<TOn>[];
  readonly secrets?: Record<string, string | Expression<string>> | 'inherit';
  readonly timeoutMinutes?: number;
  readonly strategy?: StrategyProps<TMatrix>;
  readonly continueOnError?: boolean;
  readonly container?: DockerProps;
  readonly services?: Record<string, ServiceProps>;
  readonly permissions?: Permissions;
  readonly environment?: EnvironmentConfig;
  readonly concurrency?: ConcurrencyConfig;
  readonly uses?: Workflow<any> | string;
  readonly with?: { [key: string]: string | number | boolean };
}

/**
 * Represents a GH Actions job.
 */
export class Job<TMatrix extends MatrixDefinition = MatrixDefinition, TOn extends WorkflowTrigger = WorkflowTrigger> extends Construct {
  protected readonly action: Writable<JobProps<TMatrix, TOn>>;
  public readonly id: string;
  public if?: Expression<boolean>;
  public readonly matrix: MatrixProxy<TMatrix>;

  public constructor(scope: Workflow<TOn>, id: string, config: JobProps<TMatrix, TOn>) {
    super(scope, id);
    this.id = id;
    this.action = config as Writable<JobProps<TMatrix, TOn>>;
    this.matrix = createMatrixProxy((config.strategy?.matrix ?? {}) as TMatrix);
    addJobValidation(this, () => ({
      id: this.id,
      steps: this.steps,
      runsOn: this.action.runsOn,
      uses: this.action.uses,
      matrix: this.action.strategy?.matrix as Record<string, ReadonlyArray<unknown>> | undefined,
    }));
  }

  get env(): JobProps['env'] {
    return this.action.env;
  }

  get runsOn(): JobProps['runsOn'] {
    return this.action.runsOn as JobProps['runsOn'];
  }

  get name(): string {
    if (!this.action.name) {
      throw new Error(`Job '${this.id}' is missing a 'name' property.`);
    }
    return this.action.name;
  }

  get steps(): StepConfig<TOn>[] {
    return (this.action.steps || []) as StepConfig<TOn>[];
  }

  public toGHAction(): any {
    const { uses, runsOn, steps, strategy, if: propsIf, ...rest } = this.action;

    const resolvedIf = typeof propsIf === 'function' ? propsIf(github as any) : propsIf;
    const conditions = [this.if, resolvedIf].filter((c): c is Expression<boolean> => c !== undefined);
    const _if = conditions.length > 0 ? and(...conditions) : undefined;

    let serializedUses: string | undefined;
    if (typeof uses === 'string') {
      serializedUses = uses;
    } else if (uses) {
      serializedUses = `./.github/workflows/${uses.outputFile}`;
    }

    const keyMap = {
      runsOn: 'runs-on',
      continueOnError: 'continue-on-error',
      timeoutMinutes: 'timeout-minutes',
      failFast: 'fail-fast',
      maxParallel: 'max-parallel',
      workingDirectory: 'working-directory',
      cancelInProgress: 'cancel-in-progress',
      artifactMetadata: 'artifact-metadata',
      securityEvents: 'security-events',
      repositoryProjects: 'repository-projects',
      pullRequests: 'pull-requests',
      idToken: 'id-token',
    };

    let serializedRunsOn: unknown = runsOn;
    if (runsOn && typeof runsOn === 'object' && 'group' in runsOn) {
      serializedRunsOn = {
        group: runsOn.group,
        ...(runsOn.labels ? { labels: runsOn.labels } : {}),
      };
    }

    const serializedSteps = steps?.map((s) => {
      const { if: stepIf, ...stepRest } = s;
      const resolvedStepIf = typeof stepIf === 'function' ? stepIf(github as any) : stepIf;
      const serialized = renameKeys(stepRest, keyMap);
      return {
        ...serialized,
        ...(resolvedStepIf !== undefined ? { if: resolvedStepIf } : {}),
      };
    });

    let serializedStrategy: Record<string, unknown> | undefined;
    if (strategy) {
      const { matrix, include, exclude, ...strategyRest } = strategy;
      serializedStrategy = {
        ...renameKeys(strategyRest, keyMap),
        ...(matrix || include || exclude
          ? {
              matrix: {
                ...matrix,
                ...(include?.length ? { include } : {}),
                ...(exclude?.length ? { exclude } : {}),
              },
            }
          : {}),
      };
    }

    const serializedRest = renameKeys(rest, keyMap);

    return {
      ...serializedRest,
      'runs-on': serializedRunsOn,
      uses: serializedUses,
      if: _if,
      ...(serializedStrategy ? { strategy: serializedStrategy } : {}),
      ...(serializedSteps ? { steps: serializedSteps } : {}),
    };
  }

  public addDependency(
    dependee: Job<any, any>,
    options?: {
      condition?: 'success' | 'failure' | 'always' | 'completed';
    },
  ): this {
    const needs = Array.isArray(this.action.needs) ? this.action.needs : [];
    if (typeof this.action.needs === 'string') {
      needs.push(this.action.needs);
    }
    needs.push(dependee.id);
    this.action.needs = needs;

    if (options?.condition) {
      const conditionExpr: Expression<boolean> =
        options.condition === 'always' || options.condition === 'completed'
          ? expr('always()')
          : options.condition === 'failure'
            ? expr('failure()')
            : expr('success()');

      this.if = this.if ? and(this.if, conditionExpr) : conditionExpr;
    }

    return this;
  }

  public addDependencyById(dependeeId: string) {
    const needs = Array.isArray(this.action.needs) ? this.action.needs : [];
    if (typeof this.action.needs === 'string') {
      needs.push(this.action.needs);
    }
    needs.push(dependeeId);
    this.action.needs = needs;
    return this;
  }
}
