/**
 * Type-level cron expression parser for GitHub Actions schedule syntax.
 *
 * Validates and parses standard 5-field POSIX cron at compile time:
 *   minute(0-59) hour(0-23) day-of-month(1-31) month(1-12) day-of-week(0-6)
 */

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type MinuteValue = `${Digit}` | `${1 | 2 | 3 | 4 | 5}${Digit}`;
type HourValue = `${Digit}` | `1${Digit}` | `2${'0' | '1' | '2' | '3'}`;
type DayOfMonthValue = `${Exclude<Digit, '0'>}` | `${'1' | '2'}${Digit}` | '30' | '31';
type MonthValue =
  | `${Exclude<Digit, '0'>}`
  | '10'
  | '11'
  | '12'
  | 'JAN'
  | 'FEB'
  | 'MAR'
  | 'APR'
  | 'MAY'
  | 'JUN'
  | 'JUL'
  | 'AUG'
  | 'SEP'
  | 'OCT'
  | 'NOV'
  | 'DEC';
type WeekdayValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

// --- Field validation ---

type IsAtom<S extends string, V extends string> = S extends V
  ? true
  : S extends `*/${infer Step}`
    ? Step extends V
      ? true
      : false
    : S extends `${infer Lo}-${infer Rest}`
      ? Rest extends `${infer Hi}/${infer Step}`
        ? Lo extends V
          ? Hi extends V
            ? Step extends V
              ? true
              : false
            : false
          : false
        : Lo extends V
          ? Rest extends V
            ? true
            : false
          : false
      : false;

type IsField<S extends string, V extends string> = S extends '*'
  ? true
  : S extends `${infer Head},${infer Tail}`
    ? IsAtom<Head, V> extends true
      ? IsField<Tail, V>
      : false
    : IsAtom<S, V>;

type IsValidCron<S extends string> = S extends `${infer Min} ${infer R1}`
  ? R1 extends `${infer Hr} ${infer R2}`
    ? R2 extends `${infer Dom} ${infer R3}`
      ? R3 extends `${infer Mon} ${infer Wday}`
        ? Wday extends `${string} ${string}`
          ? false
          : [
                IsField<Min, MinuteValue>,
                IsField<Hr, HourValue>,
                IsField<Dom, DayOfMonthValue>,
                IsField<Mon, MonthValue>,
                IsField<Wday, WeekdayValue>,
              ] extends [true, true, true, true, true]
            ? true
            : false
        : false
      : false
    : false
  : false;

// Resolves to the literal string type when the cron expression is valid,
// `never` otherwise. Use as a type constraint on schedule inputs.
export type CronExpression<S extends string> = IsValidCron<S> extends true ? S : never;

// --- Parsed AST representation ---

type ParsedWildcard = { readonly kind: 'wildcard' };
type ParsedValue<V extends string = string> = {
  readonly kind: 'value';
  readonly value: V;
};
type ParsedRange<Lo extends string = string, Hi extends string = string> = {
  readonly kind: 'range';
  readonly from: Lo;
  readonly to: Hi;
};
type ParsedStep<Over = unknown, Step extends string = string> = {
  readonly kind: 'step';
  readonly over: Over;
  readonly step: Step;
};
type ParsedList<Items extends readonly unknown[] = readonly unknown[]> = {
  readonly kind: 'list';
  readonly items: Items;
};

type ParseAtom<S extends string> = S extends '*'
  ? ParsedWildcard
  : S extends `*/${infer Step}`
    ? ParsedStep<ParsedWildcard, Step>
    : S extends `${infer Lo}-${infer Rest}`
      ? Rest extends `${infer Hi}/${infer Step}`
        ? ParsedStep<ParsedRange<Lo, Hi>, Step>
        : ParsedRange<Lo, Rest>
      : ParsedValue<S>;

type ParseCommaSeparated<S extends string> = S extends `${infer Head},${infer Tail}`
  ? [ParseAtom<Head>, ...ParseCommaSeparated<Tail>]
  : [ParseAtom<S>];

type ParseField<S extends string> = S extends '*'
  ? ParsedWildcard
  : S extends `${string},${string}`
    ? ParsedList<ParseCommaSeparated<S>>
    : ParseAtom<S>;

// Parses a validated cron expression into a structured type representation.
// Returns `never` for invalid expressions.
export type ParseCronExpression<S extends string> =
  IsValidCron<S> extends true
    ? S extends `${infer Min} ${infer R1}`
      ? R1 extends `${infer Hr} ${infer R2}`
        ? R2 extends `${infer Dom} ${infer R3}`
          ? R3 extends `${infer Mon} ${infer Wday}`
            ? {
                readonly minute: ParseField<Min>;
                readonly hour: ParseField<Hr>;
                readonly dayOfMonth: ParseField<Dom>;
                readonly month: ParseField<Mon>;
                readonly dayOfWeek: ParseField<Wday>;
              }
            : never
          : never
        : never
      : never
    : never;
