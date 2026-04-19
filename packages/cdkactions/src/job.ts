import { Construct } from 'constructs';

import { and, expr, type Expression } from '#src/expressions.js';
import type { RunnerLabel, Shell } from '#src/nominal.js';
import type { DefaultsProps, StringMap } from '#src/types.js';
import { renameKeys, type Writable } from '#src/utils.js';
import { addJobValidation } from '#src/validation.js';
import type { Permissions, Workflow } from '#src/workflow.js';

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

export interface StepBase {
  readonly id?: string;
  readonly name?: string;
  readonly if?: Expression<boolean>;
  readonly env?: StringMap;
  readonly continueOnError?: boolean;
  readonly timeoutMinutes?: number;
}

export interface RunStep extends StepBase {
  readonly run: string;
  readonly shell?: Shell;
  readonly workingDirectory?: string;
  readonly uses?: never;
  readonly with?: never;
}

export interface UsesStep extends StepBase {
  readonly uses: string;
  readonly with?: { [key: string]: string | number | boolean };
  readonly run?: never;
  readonly shell?: never;
  readonly workingDirectory?: never;
}

export type StepConfig = RunStep | UsesStep;

/** @deprecated Use StepConfig instead. */
export type StepsProps = StepConfig;

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
export interface JobProps<TMatrix extends MatrixDefinition = MatrixDefinition> {
  readonly name?: string;
  readonly needs?: string | string[];
  readonly runsOn?: RunnerLabel | RunnerLabel[] | RunnerGroupConfig | Expression<string>;
  readonly outputs?: StringMap;
  readonly env?: StringMap;
  readonly defaults?: DefaultsProps;
  readonly if?: Expression<boolean>;
  readonly steps?: StepConfig[];
  readonly secrets?: Record<string, string | Expression<string>> | 'inherit';
  readonly timeoutMinutes?: number;
  readonly strategy?: StrategyProps<TMatrix>;
  readonly continueOnError?: boolean;
  readonly container?: DockerProps;
  readonly services?: Record<string, ServiceProps>;
  readonly permissions?: Permissions;
  readonly environment?: EnvironmentConfig;
  readonly concurrency?: ConcurrencyConfig;
  readonly uses?: Workflow | string;
  readonly with?: { [key: string]: string | number | boolean };
}

/**
 * Represents a GH Actions job.
 */
export class Job<TMatrix extends MatrixDefinition = MatrixDefinition> extends Construct {
  protected readonly action: Writable<JobProps<TMatrix>>;
  public readonly id: string;
  public if?: Expression<boolean>;
  public readonly matrix: MatrixProxy<TMatrix>;

  public constructor(scope: Workflow, id: string, config: JobProps<TMatrix>) {
    super(scope, id);
    this.id = id;
    this.action = config as Writable<JobProps<TMatrix>>;
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

  get steps(): StepConfig[] {
    return (this.action.steps || []) as StepConfig[];
  }

  public toGHAction(): any {
    const { uses, runsOn, steps, strategy, ...rest } = this.action;

    const conditions = [this.if, this.action.if].filter((c): c is Expression<boolean> => c !== undefined);
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

    const serializedSteps = steps?.map((step) => {
      const { if: stepIf, ...stepRest } = step;
      const serialized = renameKeys(stepRest, keyMap);
      return {
        ...serialized,
        ...(stepIf !== undefined ? { if: stepIf } : {}),
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
    dependee: Job,
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
