import { spawnSync } from 'node:child_process';

export interface ActResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  parsedSuccessfully: boolean;
}

const KNOWN_ACT_LIMITATION_RE =
  /failed to connect to the docker API|no DOCKER_HOST|Couldn't get a valid docker connection/;

export function runActDryRun(workflowPath: string, event: string): ActResult {
  const result = spawnSync(
    'act',
    [
      event,
      '--dryrun',
      '--workflows',
      workflowPath,
      '--action-offline-mode',
      '--pull=false',
      '-P',
      'ubuntu-latest=node:20-slim',
      '-P',
      'ubuntu-24.04=node:20-slim',
      '-P',
      'ubuntu-22.04=node:20-slim',
    ],
    {
      encoding: 'utf-8',
      timeout: 30_000,
    },
  );

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const exitCode = result.status ?? 1;

  const jobsResolved = stdout.includes('Run Set up job');
  const knownLimitation = exitCode !== 0 && KNOWN_ACT_LIMITATION_RE.test(stderr);
  const parsedSuccessfully = exitCode === 0 || (knownLimitation && jobsResolved);

  return { exitCode, stdout, stderr, parsedSuccessfully };
}
