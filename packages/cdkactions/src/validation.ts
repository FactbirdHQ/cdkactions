import { Construct, Node, type IValidation } from 'constructs';

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type MinuteValue = `${Digit}` | `${1 | 2 | 3 | 4 | 5}${Digit}`;
type HourValue = `${Digit}` | `1${Digit}` | `2${'0' | '1' | '2' | '3'}`;
type DayOfMonthValue =
  | `${Exclude<Digit, '0'>}`
  | `${'1' | '2'}${Digit}`
  | '30'
  | '31';
type MonthValue =
  | `${Exclude<Digit, '0'>}`
  | '10'
  | '11'
  | '12'
  | 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN'
  | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC';
type WeekdayValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6'
  | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

type IsAtom<S extends string, V extends string> =
  S extends V ? true :
  S extends `*/${infer Step}` ? (Step extends V ? true : false) :
  S extends `${infer Lo}-${infer Rest}` ? (
    Rest extends `${infer Hi}/${infer Step}`
      ? (Lo extends V ? Hi extends V ? Step extends V ? true : false : false : false)
      : (Lo extends V ? Rest extends V ? true : false : false)
  ) :
  false;

type IsField<S extends string, V extends string> =
  S extends '*' ? true :
  S extends `${infer Head},${infer Tail}`
    ? (IsAtom<Head, V> extends true ? IsField<Tail, V> : false)
    : IsAtom<S, V>;

type IsValidCron<S extends string> =
  S extends `${infer Min} ${infer R1}`
    ? R1 extends `${infer Hr} ${infer R2}`
      ? R2 extends `${infer Dom} ${infer R3}`
        ? R3 extends `${infer Mon} ${infer Wday}`
          ? Wday extends `${string} ${string}` ? false
            : [IsField<Min, MinuteValue>, IsField<Hr, HourValue>, IsField<Dom, DayOfMonthValue>, IsField<Mon, MonthValue>, IsField<Wday, WeekdayValue>] extends [true, true, true, true, true]
              ? true
              : false
          : false
        : false
      : false
    : false;

export type ValidCronExpression<S extends string> = IsValidCron<S> extends true ? S : never;

const CRON_FIELD_RANGES: Array<{ name: string; min: number; max: number }> = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day of week', min: 0, max: 6 },
];

function validateCronField(field: string, range: { name: string; min: number; max: number }): string | undefined {
  if (field === '*') return undefined;

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const base = stepMatch ? stepMatch[1] : part;
    const step = stepMatch ? parseInt(stepMatch[2], 10) : undefined;

    if (step !== undefined && (step < 1 || !Number.isFinite(step))) {
      return `Invalid step value '${step}' in ${range.name} field`;
    }

    if (base === '*') continue;

    const rangeMatch = base.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const [, startStr, endStr] = rangeMatch;
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (start < range.min || start > range.max) {
        return `${range.name} range start ${start} is outside ${range.min}-${range.max}`;
      }
      if (end < range.min || end > range.max) {
        return `${range.name} range end ${end} is outside ${range.min}-${range.max}`;
      }
      if (start > end) {
        return `${range.name} range ${start}-${end} has start greater than end`;
      }
      continue;
    }

    const num = parseInt(base, 10);
    if (isNaN(num) || String(num) !== base) {
      return `Invalid ${range.name} value '${base}'`;
    }
    if (num < range.min || num > range.max) {
      return `${range.name} value ${num} is outside ${range.min}-${range.max}`;
    }
  }

  return undefined;
}

function validateCronString(cron: string): string[] {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return [`Cron expression '${cron}' must have exactly 5 fields, got ${fields.length}`];
  }

  const errors: string[] = [];
  for (let i = 0; i < 5; i++) {
    const error = validateCronField(fields[i], CRON_FIELD_RANGES[i]);
    if (error) {
      errors.push(`Cron expression '${cron}': ${error}`);
    }
  }
  return errors;
}

export class CronExpression<S extends string = string> {
  readonly expression: S;

  constructor(expression: ValidCronExpression<S>) {
    const errors = validateCronString(expression);
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    this.expression = expression as S;
  }

  static from(expression: string): CronExpression {
    const errors = validateCronString(expression);
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
    const instance = Object.create(CronExpression.prototype) as CronExpression;
    (instance as { expression: string }).expression = expression;
    return instance;
  }

  toString(): string {
    return this.expression;
  }
}

export function validateCronExpression(cron: string | CronExpression): string[] {
  const value = cron instanceof CronExpression ? cron.expression : cron;
  return validateCronString(value);
}

export interface JobValidationData {
  readonly id: string;
  readonly steps: ReadonlyArray<{ readonly id?: string; readonly name?: string; readonly run?: unknown; readonly uses?: unknown }>;
  readonly runsOn?: unknown;
  readonly uses?: unknown;
  readonly matrix?: Record<string, ReadonlyArray<unknown>>;
}

class JobValidation implements IValidation {
  constructor(private readonly data: () => JobValidationData) {}

  validate(): string[] {
    const data = this.data();
    const errors: string[] = [];

    for (const step of data.steps) {
      if (step.run !== undefined && step.uses !== undefined) {
        const stepId = step.id || step.name || '(unnamed)';
        errors.push(
          `Job '${data.id}' step '${stepId}': 'run' and 'uses' are mutually exclusive — use one or the other`,
        );
      }
    }

    if (!data.runsOn && !data.uses) {
      errors.push(
        `Job '${data.id}': 'runsOn' is required unless 'uses' (reusable workflow) is set`,
      );
    }

    if (data.matrix) {
      const keys = Object.keys(data.matrix);
      if (keys.length > 0) {
        let combinations = 1;
        for (const key of keys) {
          const values = data.matrix[key];
          if (Array.isArray(values)) {
            combinations *= values.length;
          }
        }
        if (combinations > 256) {
          errors.push(
            `Job '${data.id}': matrix produces ${combinations} combinations, exceeding GitHub's limit of 256`,
          );
        }
      }
    }

    if (data.steps.length > 1000) {
      errors.push(
        `Job '${data.id}': has ${data.steps.length} steps, exceeding the recommended limit of 1000`,
      );
    }

    return errors;
  }
}

export interface WorkflowValidationData {
  readonly name: string;
  readonly on: unknown;
}

class WorkflowValidation implements IValidation {
  constructor(private readonly data: () => WorkflowValidationData) {}

  validate(): string[] {
    const data = this.data();
    const errors: string[] = [];

    const on = data.on;
    if (typeof on === 'object' && on !== null && !Array.isArray(on)) {
      for (const [name, config] of Object.entries(on as Record<string, unknown>)) {
        if (!config || typeof config !== 'object') continue;
        const pushLike = config as { branches?: unknown[]; branchesIgnore?: unknown[] };
        if (pushLike.branches?.length && pushLike.branchesIgnore?.length) {
          errors.push(
            `Workflow '${data.name}' event '${name}': 'branches' and 'branchesIgnore' are mutually exclusive`,
          );
        }
      }

      if ('schedule' in on) {
        const schedule = (on as { schedule: Array<{ cron: string | CronExpression }> }).schedule;
        for (const entry of schedule) {
          if (entry.cron instanceof CronExpression) continue;
          for (const cronError of validateCronExpression(entry.cron)) {
            errors.push(`Workflow '${data.name}': ${cronError}`);
          }
        }
      }
    }

    return errors;
  }
}

export function addJobValidation(construct: Construct, getData: () => JobValidationData): void {
  Node.of(construct).addValidation(new JobValidation(getData));
}

export function addWorkflowValidation(construct: Construct, getData: () => WorkflowValidationData): void {
  Node.of(construct).addValidation(new WorkflowValidation(getData));
}

export function collectValidationErrors(construct: Construct): string[] {
  const root = Node.of(construct);
  const errors: string[] = [];

  for (const child of root.findAll()) {
    errors.push(...Node.of(child).validate());
  }

  return errors;
}
