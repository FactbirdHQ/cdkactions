import type { StepsProps } from './job.js';

/**
 * A step with a known `id` string literal, used by the builder
 * to track which IDs have been claimed.
 */
type IdentifiedStep<Id extends string> = StepsProps & { readonly id: Id };

/**
 * A step that is guaranteed *not* to carry an `id`, so it can
 * never collide with anything.
 */
type AnonymousStep = StepsProps & { readonly id?: undefined };

/**
 * Accepts either an anonymous step or an identified step whose
 * `id` has not yet been used.
 */
type NewStep<UsedIds extends string> =
  | AnonymousStep
  | (IdentifiedStep<string> & { readonly id: string extends infer Id extends string
      ? Id extends UsedIds ? never : Id
      : never });

/**
 * Fluent builder that assembles an ordered list of steps while
 * rejecting duplicate `id` values at compile time.
 *
 * @typeParam UsedIds - Union of step `id` literals added so far.
 *
 * @example
 * ```ts
 * const steps = new JobStepBuilder()
 *   .step({ run: 'echo hello' })
 *   .step(myAction.asStep(scope, { id: 'fetch' }))
 *   .step(other.asStep(scope, { id: 'fetch' }))  // TS error — duplicate id
 *   .build();
 * ```
 */
export class JobStepBuilder<UsedIds extends string = never> {
  private readonly steps: StepsProps[];

  /** @internal */
  constructor(steps: StepsProps[] = []) {
    this.steps = steps;
  }

  /**
   * Append a step without an `id` (never conflicts).
   */
  step(step: AnonymousStep): JobStepBuilder<UsedIds>;
  /**
   * Append a step whose `id` must not already be present in the builder.
   */
  step<Id extends string>(
    step: IdentifiedStep<Id extends UsedIds ? never : Id>,
  ): JobStepBuilder<UsedIds | Id>;
  step(step: StepsProps): JobStepBuilder<any> {
    return new JobStepBuilder([...this.steps, step]);
  }

  /**
   * Return the accumulated steps array, ready to pass to `JobProps.steps`.
   */
  build(): StepsProps[] {
    return this.steps;
  }
}
