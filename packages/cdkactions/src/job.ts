import { Construct } from 'constructs';
import { match, P } from 'ts-pattern';

import type { Expression } from '#@/expressions.js';
import type { RunnerLabel, Shell } from '#@/nominal.js';
import type { DefaultsProps, StringMap } from '#@/types.js';
import { renameKeys, type Writable } from '#@/utils.js';
import type { Permissions } from '#@/workflow.js';
import type { Workflow } from '#@/workflow.js';

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

export type EnvironmentConfig = string | { readonly name: string; readonly url?: string };

export type ConcurrencyConfig = string | { readonly group: string; readonly cancelInProgress?: boolean };

export interface RunnerGroupConfig {
  readonly group: string;
  readonly labels?: RunnerLabel[];
}

export interface StepBase {
  readonly id?: string;
  readonly name?: string;
  readonly if?: Condition | Expression<boolean>;
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

export function createMatrixProxy<TMatrix extends MatrixDefinition>(
  _matrix: TMatrix,
): MatrixProxy<TMatrix> {
  return new Proxy({} as MatrixProxy<TMatrix>, {
    get(_target, prop: string) {
      return `\${{ matrix.${prop} }}` as Expression<unknown>;
    },
  });
}

/**
 * Represents a conditional expression that can be composed with nested and recursive
 * statements using `||` and `&&` operators.
 */
export class Condition {
  private expression: ConditionExpression;

  constructor(expression: ConditionExpression) {
    this.expression = expression;
  }

  static from(condition: string | undefined | null): Condition {
    if (!condition || condition.trim() === '') {
      return new Condition('');
    }
    return new Condition(condition);
  }

  static and(left: Condition | string | undefined, right: Condition | string | undefined): Condition {
    const leftCondition = typeof left === 'string' ? Condition.from(left) : left || Condition.from('');
    const rightCondition = typeof right === 'string' ? Condition.from(right) : right || Condition.from('');
    return leftCondition.and(rightCondition);
  }

  static or(left: Condition | string | undefined, right: Condition | string | undefined): Condition {
    const leftCondition = typeof left === 'string' ? Condition.from(left) : left || Condition.from('');
    const rightCondition = typeof right === 'string' ? Condition.from(right) : right || Condition.from('');
    return leftCondition.or(rightCondition);
  }

  and(other: Condition | string): Condition {
    const otherExpr = typeof other === 'string' ? other : other.expression;
    const thisConditions = this.extractAndConditions(this.expression);
    const otherConditions = this.extractAndConditions(otherExpr);
    return new Condition({
      and: [...thisConditions, ...otherConditions],
    });
  }

  or(other: Condition | string): Condition {
    const otherExpr = typeof other === 'string' ? other : other.expression;
    const thisConditions = this.extractOrConditions(this.expression);
    const otherConditions = this.extractOrConditions(otherExpr);
    return new Condition({
      or: [...thisConditions, ...otherConditions],
    });
  }

  toString(): string {
    return this.evaluateExpression(this.expression);
  }

  private evaluateExpression(expr: ConditionExpression): string {
    if (typeof expr === 'string') {
      return expr;
    }

    return match(expr)
      .with({ or: P.select() }, (conditions) => {
        const evaluatedConditions = conditions
          .map((condition) => this.evaluateExpression(condition))
          .filter((cond) => cond.trim() !== '');

        if (evaluatedConditions.length === 0) return '';
        if (evaluatedConditions.length === 1) return evaluatedConditions[0];
        return `(${evaluatedConditions.join(' || ')})`;
      })
      .with({ and: P.select() }, (conditions) => {
        const evaluatedConditions = conditions
          .map((condition) => this.evaluateExpression(condition))
          .filter((cond) => cond.trim() !== '');

        if (evaluatedConditions.length === 0) return '';
        if (evaluatedConditions.length === 1) return evaluatedConditions[0];
        return `(${evaluatedConditions.join(' && ')})`;
      })
      .exhaustive();
  }

  private extractOrConditions(expr: ConditionExpression): ConditionExpression[] {
    if (typeof expr === 'string') return [expr];
    if ('or' in expr) return expr.or.flatMap((condition) => this.extractOrConditions(condition));
    return [expr];
  }

  private extractAndConditions(expr: ConditionExpression): ConditionExpression[] {
    if (typeof expr === 'string') return [expr];
    if ('and' in expr) return expr.and.flatMap((condition) => this.extractAndConditions(condition));
    return [expr];
  }
}

type ConditionExpression =
  | string
  | { or: Array<ConditionExpression> }
  | { and: Array<ConditionExpression> };

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
  readonly if?: string | Condition;
  readonly steps?: StepConfig[];
  readonly secrets?: Record<string, string | Expression<string>> | 'inherit';
  readonly timeoutMinutes?: number;
  readonly strategy?: StrategyProps<TMatrix>;
  readonly continueOnError?: boolean;
  readonly container?: DockerProps;
  readonly services?: { [key: string]: DockerProps };
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
  public if?: Condition;
  public readonly matrix: MatrixProxy<TMatrix>;

  public constructor(scope: Workflow, id: string, config: JobProps<TMatrix>) {
    super(scope, id);
    this.id = id;
    this.action = config as Writable<JobProps<TMatrix>>;
    this.matrix = createMatrixProxy((config.strategy?.matrix ?? {}) as TMatrix);
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

  private static serializeStepIf(stepIf: unknown): string | undefined {
    if (stepIf === undefined) return undefined;
    if (stepIf instanceof Condition) return stepIf.toString();
    return String(stepIf);
  }

  public toGHAction(): any {
    const { uses, runsOn, steps, strategy, ...rest } = this.action;

    const _if = this.if?.toString() || (this.action.if instanceof Condition ? this.action.if.toString() : this.action.if);

    let serializedRunsOn: unknown = runsOn;
    if (runsOn && typeof runsOn === 'object' && 'group' in runsOn) {
      serializedRunsOn = { group: runsOn.group, ...(runsOn.labels ? { labels: runsOn.labels } : {}) };
    }

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

    const serializedSteps = steps?.map((step) => {
      const { if: stepIf, ...stepRest } = step;
      return {
        ...renameKeys(stepRest, keyMap),
        ...(stepIf !== undefined ? { if: Job.serializeStepIf(stepIf) } : {}),
      };
    });

    let serializedStrategy: Record<string, unknown> | undefined;
    if (strategy) {
      const { matrix, include, exclude, ...strategyRest } = strategy;
      serializedStrategy = {
        ...renameKeys(strategyRest, keyMap),
        ...(matrix || include || exclude ? {
          matrix: {
            ...matrix,
            ...(include?.length ? { include } : {}),
            ...(exclude?.length ? { exclude } : {}),
          },
        } : {}),
      };
    }

    return {
      ...renameKeys(rest, keyMap),
      'runs-on': serializedRunsOn,
      uses: serializedUses,
      if: _if,
      ...(serializedStrategy ? { strategy: serializedStrategy } : {}),
      ...(serializedSteps ? { steps: serializedSteps } : {}),
    };
  }

  public addDependency(dependee: Job) {
    const needs = Array.isArray(this.action.needs) ? this.action.needs : [];
    if (typeof this.action.needs === 'string') {
      needs.push(this.action.needs);
    }
    needs.push(dependee.id);
    this.action.needs = needs;
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
