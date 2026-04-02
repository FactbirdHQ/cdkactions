import { Construct } from 'constructs';
import { match, P } from 'ts-pattern';

import type { DefaultsProps, RunProps, StringMap } from './types.js';
import { renameKeys, type Writable } from './utils.js';
import type { Workflow } from './workflow.js';

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

/**
 * Propsuration for a single GitHub Action step.
 */
export interface StepsProps extends RunProps {
  readonly id?: string;
  readonly if?: string;
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly with?: { [key: string]: string | number | boolean };
  readonly env?: StringMap;
  readonly continueOnError?: boolean;
  readonly timeoutMinutes?: number;
}

/**
 * Strategy configuration block.
 */
export interface StrategyProps {
  readonly matrix?: { [key: string]: Array<any> };
  readonly fastFail?: boolean;
  readonly maxParallel?: number;
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
export interface JobProps {
  readonly name?: string;
  readonly needs?: string | string[];
  readonly runsOn?: string | string[];
  readonly outputs?: StringMap;
  readonly env?: StringMap;
  readonly defaults?: DefaultsProps;
  readonly if?: string | Condition;
  readonly steps?: StepsProps[];
  readonly secrets?: string;
  readonly timeoutMinutes?: number;
  readonly strategy?: StrategyProps;
  readonly continueOnError?: boolean;
  readonly container?: DockerProps;
  readonly services?: { [key: string]: DockerProps };
  readonly permissions?: { contents?: 'write' };
  readonly environment?: string;
  readonly uses?: Workflow;
  readonly with?: { [key: string]: string | number | boolean };
}

/**
 * Represents a GH Actions job.
 */
export class Job extends Construct {
  protected readonly action: Writable<JobProps>;
  public readonly id: string;
  public if?: Condition;

  public constructor(scope: Workflow, id: string, config: JobProps) {
    super(scope, id);
    this.id = id;
    this.action = config;
  }

  get env(): JobProps['env'] {
    return this.action.env;
  }

  get runsOn(): JobProps['runsOn'] {
    return this.action.runsOn;
  }

  get name(): string {
    if (!this.action.name) {
      throw new Error(`Job '${this.id}' is missing a 'name' property.`);
    }
    return this.action.name;
  }

  get steps(): StepsProps[] {
    return this.action.steps || [];
  }

  public toGHAction(): any {
    const { uses, ...actionWithoutUses } = this.action;

    const _if = this.if?.toString() || this.action.if;

    return {
      ...renameKeys(actionWithoutUses, {
        runsOn: 'runs-on',
        continueOnError: 'continue-on-error',
        timeoutMinutes: 'timeout-minutes',
        fastFail: 'fail-fast',
        maxParallel: 'max-parallel',
        workingDirectory: 'working-directory',
      }),
      uses: uses ? `./.github/workflows/${uses.outputFile}` : undefined,
      if: _if,
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
