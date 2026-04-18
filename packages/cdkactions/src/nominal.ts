/**
 * Nominal (branded) types for GitHub Actions values.
 *
 * These prevent accidental use of bare strings where a specific label,
 * shell, or result value is expected. Each type uses a unique symbol brand
 * so that plain strings are not assignable without going through the
 * constructors or predefined constants.
 */

declare const RunnerLabelBrand: unique symbol;

/**
 * A branded string representing a GitHub Actions runner label.
 * Bare strings are not assignable — use the predefined constants
 * or `RunnerLabel.custom()`.
 */
export type RunnerLabel = string & { readonly [RunnerLabelBrand]: true };

function runnerLabel(value: string): RunnerLabel {
  return value as RunnerLabel;
}

/** Predefined GitHub-hosted runner labels and a `custom()` escape hatch. */
export namespace RunnerLabel {
  export const UBUNTU_LATEST = runnerLabel('ubuntu-latest');
  export const UBUNTU_22_04 = runnerLabel('ubuntu-22.04');
  export const UBUNTU_24_04 = runnerLabel('ubuntu-24.04');
  export const WINDOWS_LATEST = runnerLabel('windows-latest');
  export const WINDOWS_2022 = runnerLabel('windows-2022');
  export const WINDOWS_2025 = runnerLabel('windows-2025');
  export const MACOS_LATEST = runnerLabel('macos-latest');
  export const MACOS_13 = runnerLabel('macos-13');
  export const MACOS_14 = runnerLabel('macos-14');
  export const MACOS_15 = runnerLabel('macos-15');
  export const SELF_HOSTED = runnerLabel('self-hosted');

  /** Create a RunnerLabel for a custom or self-hosted runner label. */
  export function custom(label: string): RunnerLabel {
    return runnerLabel(label);
  }
}

declare const ShellBrand: unique symbol;

/**
 * A branded string representing a shell type for step execution.
 * Bare strings are not assignable — use the predefined constants
 * or `Shell.custom()`.
 */
export type Shell = string & { readonly [ShellBrand]: true };

function shell(value: string): Shell {
  return value as Shell;
}

/** Predefined shell values and a `custom()` escape hatch. */
export namespace Shell {
  export const BASH = shell('bash');
  export const PWSH = shell('pwsh');
  export const PYTHON = shell('python');
  export const SH = shell('sh');
  export const CMD = shell('cmd');
  export const POWERSHELL = shell('powershell');

  /** Create a Shell for a custom shell command. */
  export function custom(value: string): Shell {
    return shell(value);
  }
}

declare const JobResultBrand: unique symbol;

/**
 * A branded string representing a job result status.
 * Used in `needs.<job>.result` comparisons.
 */
export type JobResult = string & { readonly [JobResultBrand]: true };

function jobResult(value: string): JobResult {
  return value as JobResult;
}

/** Predefined job result values. */
export namespace JobResult {
  export const SUCCESS = jobResult('success');
  export const FAILURE = jobResult('failure');
  export const CANCELLED = jobResult('cancelled');
  export const SKIPPED = jobResult('skipped');
}

declare const StepConclusionBrand: unique symbol;

/**
 * A branded string representing a step conclusion status.
 * Used in `steps.<step>.conclusion` comparisons.
 */
export type StepConclusion = string & { readonly [StepConclusionBrand]: true };

function stepConclusion(value: string): StepConclusion {
  return value as StepConclusion;
}

/** Predefined step conclusion values. */
export namespace StepConclusion {
  export const SUCCESS = stepConclusion('success');
  export const FAILURE = stepConclusion('failure');
  export const CANCELLED = stepConclusion('cancelled');
  export const SKIPPED = stepConclusion('skipped');
}
