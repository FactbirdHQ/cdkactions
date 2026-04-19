import { JobResult, RunnerLabel, Shell, StepConclusion } from '#src/index.ts';

test('RunnerLabel predefined constants have correct string values', () => {
  expect(String(RunnerLabel.UBUNTU_LATEST)).toBe('ubuntu-latest');
  expect(String(RunnerLabel.UBUNTU_22_04)).toBe('ubuntu-22.04');
  expect(String(RunnerLabel.UBUNTU_24_04)).toBe('ubuntu-24.04');
  expect(String(RunnerLabel.WINDOWS_LATEST)).toBe('windows-latest');
  expect(String(RunnerLabel.WINDOWS_2022)).toBe('windows-2022');
  expect(String(RunnerLabel.WINDOWS_2025)).toBe('windows-2025');
  expect(String(RunnerLabel.MACOS_LATEST)).toBe('macos-latest');
  expect(String(RunnerLabel.MACOS_13)).toBe('macos-13');
  expect(String(RunnerLabel.MACOS_14)).toBe('macos-14');
  expect(String(RunnerLabel.MACOS_15)).toBe('macos-15');
  expect(String(RunnerLabel.SELF_HOSTED)).toBe('self-hosted');
});

test('RunnerLabel.custom() creates a RunnerLabel from arbitrary string', () => {
  const custom = RunnerLabel.custom('my-custom-runner');
  expect(String(custom)).toBe('my-custom-runner');
});

test('Shell predefined constants have correct string values', () => {
  expect(String(Shell.BASH)).toBe('bash');
  expect(String(Shell.PWSH)).toBe('pwsh');
  expect(String(Shell.PYTHON)).toBe('python');
  expect(String(Shell.SH)).toBe('sh');
  expect(String(Shell.CMD)).toBe('cmd');
  expect(String(Shell.POWERSHELL)).toBe('powershell');
});

test('Shell.custom() creates a Shell from arbitrary string', () => {
  const custom = Shell.custom('perl {0}');
  expect(String(custom)).toBe('perl {0}');
});

test('JobResult constants have correct string values', () => {
  expect(String(JobResult.SUCCESS)).toBe('success');
  expect(String(JobResult.FAILURE)).toBe('failure');
  expect(String(JobResult.CANCELLED)).toBe('cancelled');
  expect(String(JobResult.SKIPPED)).toBe('skipped');
});

test('StepConclusion constants have correct string values', () => {
  expect(String(StepConclusion.SUCCESS)).toBe('success');
  expect(String(StepConclusion.FAILURE)).toBe('failure');
  expect(String(StepConclusion.CANCELLED)).toBe('cancelled');
  expect(String(StepConclusion.SKIPPED)).toBe('skipped');
});

// These verify that bare strings are NOT assignable to nominal types.

// @ts-expect-error — bare string is not assignable to RunnerLabel
const _badRunner: RunnerLabel = 'ubuntu-latest';

// @ts-expect-error — bare string is not assignable to Shell
const _badShell: Shell = 'bash';

// @ts-expect-error — bare string is not assignable to JobResult
const _badResult: JobResult = 'success';

// @ts-expect-error — bare string is not assignable to StepConclusion
const _badConclusion: StepConclusion = 'success';

// Valid assignments through constructors
const _goodRunner: RunnerLabel = RunnerLabel.UBUNTU_LATEST;
const _goodCustomRunner: RunnerLabel = RunnerLabel.custom('my-runner');
const _goodShell: Shell = Shell.BASH;
const _goodCustomShell: Shell = Shell.custom('zsh');
const _goodResult: JobResult = JobResult.SUCCESS;
const _goodConclusion: StepConclusion = StepConclusion.SUCCESS;

// Suppress unused variable warnings
void _badRunner;
void _badShell;
void _badResult;
void _badConclusion;
void _goodRunner;
void _goodCustomRunner;
void _goodShell;
void _goodCustomShell;
void _goodResult;
void _goodConclusion;
