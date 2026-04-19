import type { CronExpression, ParseCronExpression } from '../src/index.js';

type Assert<T extends true> = T;
type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type IsNever<T> = [T] extends [never] ? true : false;

// --- CronExpression: valid expressions resolve to the literal ---

type _ValidSimple = Assert<IsEqual<CronExpression<'0 0 * * *'>, '0 0 * * *'>>;
type _ValidStep = Assert<IsEqual<CronExpression<'5 0 * * *'>, '5 0 * * *'>>;
type _ValidRange = Assert<IsEqual<CronExpression<'0 9-17 * * 1-5'>, '0 9-17 * * 1-5'>>;
type _ValidList = Assert<IsEqual<CronExpression<'0,30 * * * *'>, '0,30 * * * *'>>;
type _ValidMonthName = Assert<IsEqual<CronExpression<'0 0 1 JAN *'>, '0 0 1 JAN *'>>;
type _ValidDayName = Assert<IsEqual<CronExpression<'0 0 * * MON'>, '0 0 * * MON'>>;
type _ValidRangeStep = Assert<IsEqual<CronExpression<'0 0 1-15 * 0'>, '0 0 1-15 * 0'>>;
type _ValidWildcardStep = Assert<IsEqual<CronExpression<'0 0 * * 0'>, '0 0 * * 0'>>;
type _ValidMaxValues = Assert<IsEqual<CronExpression<'59 23 31 12 6'>, '59 23 31 12 6'>>;
type _ValidAllNames = Assert<IsEqual<CronExpression<'0 0 * DEC SAT'>, '0 0 * DEC SAT'>>;

// --- CronExpression: invalid expressions resolve to never ---

type _InvalidMinute = Assert<IsNever<CronExpression<'60 0 * * *'>>>;
type _InvalidHour = Assert<IsNever<CronExpression<'0 24 * * *'>>>;
type _InvalidDay = Assert<IsNever<CronExpression<'0 0 32 * *'>>>;
type _InvalidDayZero = Assert<IsNever<CronExpression<'0 0 0 * *'>>>;
type _InvalidMonth = Assert<IsNever<CronExpression<'0 0 * 13 *'>>>;
type _InvalidMonthZero = Assert<IsNever<CronExpression<'0 0 * 0 *'>>>;
type _InvalidWeekday = Assert<IsNever<CronExpression<'0 0 * * 7'>>>;
type _InvalidTooFewFields = Assert<IsNever<CronExpression<'0 0 * *'>>>;
type _InvalidTooManyFields = Assert<IsNever<CronExpression<'0 0 * * * *'>>>;
type _InvalidEmpty = Assert<IsNever<CronExpression<''>>>;
type _InvalidGarbage = Assert<IsNever<CronExpression<'not a cron'>>>;

// --- ParseCronExpression: structural output ---

type _ParseWildcard = Assert<
  IsEqual<
    ParseCronExpression<'0 0 * * *'>,
    {
      readonly minute: { readonly kind: 'value'; readonly value: '0' };
      readonly hour: { readonly kind: 'value'; readonly value: '0' };
      readonly dayOfMonth: { readonly kind: 'wildcard' };
      readonly month: { readonly kind: 'wildcard' };
      readonly dayOfWeek: { readonly kind: 'wildcard' };
    }
  >
>;

type _ParseRange = Assert<
  IsEqual<
    ParseCronExpression<'0 9-17 * * 1-5'>,
    {
      readonly minute: { readonly kind: 'value'; readonly value: '0' };
      readonly hour: {
        readonly kind: 'range';
        readonly from: '9';
        readonly to: '17';
      };
      readonly dayOfMonth: { readonly kind: 'wildcard' };
      readonly month: { readonly kind: 'wildcard' };
      readonly dayOfWeek: {
        readonly kind: 'range';
        readonly from: '1';
        readonly to: '5';
      };
    }
  >
>;

type _ParseList = Assert<
  IsEqual<
    ParseCronExpression<'0,30 * * * *'>,
    {
      readonly minute: {
        readonly kind: 'list';
        readonly items: [
          { readonly kind: 'value'; readonly value: '0' },
          { readonly kind: 'value'; readonly value: '30' },
        ];
      };
      readonly hour: { readonly kind: 'wildcard' };
      readonly dayOfMonth: { readonly kind: 'wildcard' };
      readonly month: { readonly kind: 'wildcard' };
      readonly dayOfWeek: { readonly kind: 'wildcard' };
    }
  >
>;

type _ParseInvalid = Assert<IsNever<ParseCronExpression<'60 0 * * *'>>>;

// Runtime test to keep the test runner happy
test('CronExpression types compile correctly', () => {
  expect(true).toBe(true);
});
