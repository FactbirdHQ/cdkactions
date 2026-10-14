import { type ExecFileSyncOptions, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { PinnedActionRef } from '#src/action.ts';

export interface GitHubTags {
  /**
   * One repository's `git ls-remote --tags` output, or undefined when GitHub cannot be reached.
   * Throws for any other failure, such as a repository that does not exist.
   */
  probe(repository: string): string | undefined;
  /** Reads every repository in parallel; throws when any read fails. */
  listAll(repositories: readonly string[]): Map<string, string>;
}

export interface PinProblem {
  readonly pin: PinnedActionRef;
  readonly message: string;
}

export type PinCheckResult =
  | {
      readonly reachable: true;
      readonly problems: readonly PinProblem[];
      readonly unversioned: readonly PinnedActionRef[];
    }
  | { readonly reachable: false; readonly unverified: readonly PinnedActionRef[] };

const UNREACHABLE =
  /Could not resolve host|Failed to connect|Couldn't connect|Connection refused|Connection timed out|Operation timed out|Network is unreachable|Temporary failure in name resolution/i;
const PROBE_TIMEOUT_MS = 15_000;
const LIST_TIMEOUT_MS = 120_000;
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

export function actionRepository(action: string): string {
  return action.split('/').slice(0, 2).join('/');
}

function tagsUrl(repository: string): string {
  return `https://github.com/${repository}`;
}

/** Each tag's commit; an annotated tag's peeled `^{}` line carries the commit it points at. */
export function parseTagCommits(lsRemoteOutput: string): Map<string, string> {
  const commitByTag = new Map<string, string>();
  for (const line of lsRemoteOutput.split('\n')) {
    const [commit, ref] = line.trim().split(/\s+/);
    if (!commit || !ref?.startsWith('refs/tags/')) continue;
    const peeled = ref.endsWith('^{}');
    const tag = ref.slice('refs/tags/'.length, peeled ? -'^{}'.length : undefined);
    if (peeled || !commitByTag.has(tag)) commitByTag.set(tag, commit);
  }
  return commitByTag;
}

export type RunFile = (file: string, args: readonly string[], options: ExecFileSyncOptions) => string | Buffer;

export type ProcessFailure =
  | { readonly kind: 'spawn'; readonly errno: string; readonly detail: string }
  | { readonly kind: 'network'; readonly detail: string }
  | { readonly kind: 'exit'; readonly detail: string };

/**
 * Sorts a failed `execFileSync`. A process that never started, such as `ENOENT`, `EPERM` or
 * `EACCES`, says nothing about the network. Only a timeout, or a git exit whose stderr shows a
 * resolve or connect failure, means GitHub cannot be reached.
 */
export function classifyProcessFailure(error: unknown): ProcessFailure {
  const failure: { code?: unknown; status?: unknown; signal?: unknown; stderr?: unknown; message?: unknown } =
    typeof error === 'object' && error !== null ? error : {};
  const stderr = String(failure.stderr ?? '').trim();
  const detail = stderr || String(failure.message ?? error);
  if (failure.status == null && failure.signal == null) {
    return { kind: 'spawn', errno: String(failure.code ?? 'unknown'), detail: String(failure.message ?? error) };
  }
  if (failure.code === 'ETIMEDOUT' || UNREACHABLE.test(stderr)) return { kind: 'network', detail };
  return { kind: 'exit', detail };
}

function spawnError(binary: string, failure: { readonly errno: string; readonly detail: string }): Error {
  return new Error(`could not start ${binary} (${failure.errno}) to read action tags: ${failure.detail}`);
}

export function createGitHubTags(
  run: RunFile = (file, args, options) => execFileSync(file, args, options),
): GitHubTags {
  return {
    probe(repository) {
      try {
        return String(
          run('git', ['ls-remote', '--tags', tagsUrl(repository)], {
            encoding: 'utf-8',
            env: GIT_ENV,
            timeout: PROBE_TIMEOUT_MS,
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 64 * 1024 * 1024,
          }),
        );
      } catch (error) {
        const failure = classifyProcessFailure(error);
        if (failure.kind === 'spawn') throw spawnError('git', failure);
        if (failure.kind === 'network') return undefined;
        throw new Error(`git ls-remote --tags ${tagsUrl(repository)} failed: ${failure.detail}`);
      }
    },

    listAll(repositories) {
      const outputs = new Map<string, string>();
      if (repositories.length === 0) return outputs;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdkactions-tags-'));
      try {
        try {
          run(
            'sh',
            [
              '-c',
              'dir=$1; shift; i=0; for repo in "$@"; do ' +
                '( git ls-remote --tags "https://github.com/$repo" > "$dir/$i.out" 2> "$dir/$i.err"; echo $? > "$dir/$i.status" ) & ' +
                'i=$((i+1)); done; wait',
              'sh',
              dir,
              ...repositories,
            ],
            { env: GIT_ENV, timeout: LIST_TIMEOUT_MS, stdio: 'ignore' },
          );
        } catch (error) {
          const failure = classifyProcessFailure(error);
          if (failure.kind === 'spawn') throw spawnError('sh', failure);
          throw new Error(`reading the tags of ${repositories.join(', ')} failed: ${failure.detail}`);
        }
        repositories.forEach((repository, index) => {
          const status = fs.readFileSync(path.join(dir, `${index}.status`), 'utf-8').trim();
          if (status !== '0') {
            const stderr = fs.readFileSync(path.join(dir, `${index}.err`), 'utf-8').trim();
            throw new Error(`git ls-remote --tags ${tagsUrl(repository)} failed: ${stderr}`);
          }
          outputs.set(repository, fs.readFileSync(path.join(dir, `${index}.out`), 'utf-8'));
        });
        return outputs;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

export const gitHubTags: GitHubTags = createGitHubTags();

/**
 * Checks that each versioned pin's tag points at its SHA, reading every repository once. The first
 * repository doubles as the reachability probe; once it answers, any failed read throws, so a flaky
 * network never leaves the check half done.
 */
export function checkPinnedActions(pins: readonly PinnedActionRef[], tags: GitHubTags = gitHubTags): PinCheckResult {
  const unique = new Map<string, PinnedActionRef>();
  for (const pin of pins) unique.set(`${pin.action}@${pin.sha}#${pin.version ?? ''}`, pin);
  const versioned = [...unique.values()].filter((pin) => pin.version !== undefined);
  const unversioned = [...unique.values()].filter((pin) => pin.version === undefined);
  if (versioned.length === 0) return { reachable: true, problems: [], unversioned };

  const repositories = [...new Set(versioned.map((pin) => actionRepository(pin.action)))];
  const [probeRepository, ...rest] = repositories;
  const probed = tags.probe(probeRepository);
  if (probed === undefined) return { reachable: false, unverified: versioned };

  const outputs = tags.listAll(rest);
  outputs.set(probeRepository, probed);

  const problems: PinProblem[] = [];
  for (const pin of versioned) {
    const commit = parseTagCommits(outputs.get(actionRepository(pin.action)) ?? '').get(pin.version ?? '');
    const pinned = `${pin.action}@${pin.sha}`;
    if (commit === undefined) {
      problems.push({
        pin,
        message: `${pinned} names ${pin.version}, but ${actionRepository(pin.action)} has no tag ${pin.version}`,
      });
    } else if (commit !== pin.sha) {
      problems.push({
        pin,
        message:
          `${pinned} names ${pin.version}, but ${pin.version} now points at ${commit}. ` +
          'If nobody changed this pin, the tag moved after the pin was reviewed.',
      });
    }
  }
  return { reachable: true, problems, unversioned };
}

export type PinnedActionChecker = (pins: readonly PinnedActionRef[]) => PinCheckResult;

let pinnedActionChecker: PinnedActionChecker = (pins) => checkPinnedActions(pins);

export function currentPinnedActionChecker(): PinnedActionChecker {
  return pinnedActionChecker;
}

/** Swaps the checker `App.synth()` uses, for tests that must not reach the network. */
export function usePinnedActionChecker(checker: PinnedActionChecker): PinnedActionChecker {
  const previous = pinnedActionChecker;
  pinnedActionChecker = checker;
  return previous;
}
