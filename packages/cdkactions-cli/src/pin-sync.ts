import * as path from 'node:path';

export interface PinBump {
  readonly action: string;
  readonly oldRef: string;
  readonly newRef: string;
}

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

export interface PinRewrite {
  readonly bump: PinBump;
  /** The release tag at `newRef`, or undefined when no semver tag points at it. */
  readonly version: string | undefined;
  readonly locations: readonly string[];
}

export interface SyncResult {
  readonly files: readonly SourceFile[];
  readonly rewrites: readonly PinRewrite[];
  /** Bumps the sources already carry, so nothing was rewritten for them. */
  readonly alreadyCarried: readonly PinBump[];
  readonly errors: readonly string[];
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const USES_LINE = /^([+-])\s*(?:-\s+)?uses:\s*["']?([^@\s"']+)@([^\s"'#]+)/;
const GENERATED_WORKFLOW = /^cdkactions_.*\.ya?ml$/;
const SEMVER_TAG = /^v?\d+(?:\.\d+){0,2}$/;
const TRAILING_VERSION_COMMENT = /(\/\/\s*)(v?\d[^\s]*)(\s*)$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRemoteAction(action: string): boolean {
  return !action.startsWith('./') && !action.startsWith('docker://') && action.split('/').length >= 2;
}

/**
 * Pairs each removed `uses: <action>@<old>` line of a generated workflow with the added line for
 * the same action, file by file.
 */
export function parseWorkflowBumps(diff: string): PinBump[] {
  const bumps = new Map<string, PinBump>();
  let removed: Array<{ action: string; ref: string }> = [];
  let added: Array<{ action: string; ref: string }> = [];
  let inGeneratedFile = false;

  const flushFile = () => {
    const unpaired = [...added];
    for (const old of removed) {
      const index = unpaired.findIndex((candidate) => candidate.action === old.action);
      if (index < 0) continue;
      const [replacement] = unpaired.splice(index, 1);
      if (replacement.ref === old.ref) continue;
      const bump = { action: old.action, oldRef: old.ref, newRef: replacement.ref };
      const key = `${bump.action}@${bump.oldRef}`;
      const seen = bumps.get(key);
      if (seen && seen.newRef !== bump.newRef) {
        throw new Error(`${key} moved to both ${seen.newRef} and ${bump.newRef} in one diff`);
      }
      bumps.set(key, bump);
    }
    removed = [];
    added = [];
  };

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flushFile();
      const target = line.split(' b/').pop() ?? '';
      inGeneratedFile = GENERATED_WORKFLOW.test(path.posix.basename(target));
      continue;
    }
    if (!inGeneratedFile || line.startsWith('+++') || line.startsWith('---')) continue;
    const match = USES_LINE.exec(line);
    if (!match || !isRemoteAction(match[2])) continue;
    (match[1] === '-' ? removed : added).push({ action: match[2], ref: match[3] });
  }
  flushFile();

  return [...bumps.values()];
}

export function findUnpinnedBumps(bumps: readonly PinBump[]): string[] {
  return bumps
    .filter((bump) => !COMMIT_SHA.test(bump.newRef))
    .map((bump) => `${bump.action}: moved to '${bump.newRef}', which is not a 40-character commit SHA`);
}

/**
 * Picks the most specific semver tag that points at `sha` in `git ls-remote --tags` output, so
 * `v7.0.1` wins over `v7`. An annotated tag's peeled `^{}` line carries the commit it points at.
 */
export function resolveVersion(lsRemoteOutput: string, sha: string): string | undefined {
  const commitByTag = new Map<string, string>();
  for (const line of lsRemoteOutput.split('\n')) {
    const [commit, ref] = line.trim().split(/\s+/);
    if (!commit || !ref?.startsWith('refs/tags/')) continue;
    const peeled = ref.endsWith('^{}');
    const tag = ref.slice('refs/tags/'.length, peeled ? -'^{}'.length : undefined);
    if (peeled || !commitByTag.has(tag)) commitByTag.set(tag, commit);
  }

  const candidates = [...commitByTag]
    .filter(([tag, commit]) => commit === sha && SEMVER_TAG.test(tag))
    .map(([tag]) => tag);
  candidates.sort((a, b) => b.split('.').length - a.split('.').length || a.localeCompare(b));
  return candidates[0];
}

export function actionRepository(action: string): string {
  return action.split('/').slice(0, 2).join('/');
}

function rewritePlainPins(text: string, bump: PinBump, version: string | undefined): [string, number[]] {
  const pattern = new RegExp(`(?<![\\w./-])${escapeRegExp(`${bump.action}@${bump.oldRef}`)}(?![\\w.-])`, 'g');
  const lines: number[] = [];
  const rewritten = text.split('\n').map((line, index) => {
    if (!pattern.test(line)) return line;
    pattern.lastIndex = 0;
    lines.push(index + 1);
    const repinned = line.replace(pattern, `${bump.action}@${bump.newRef}`);
    return version === undefined ? repinned : repinned.replace(TRAILING_VERSION_COMMENT, `$1${version}$3`);
  });
  return [rewritten.join('\n'), lines];
}

function rewriteTypedPins(text: string, bump: PinBump, version: string | undefined): [string, number[]] {
  if (!COMMIT_SHA.test(bump.oldRef)) return [text, []];
  const pattern = new RegExp(`(['"\`])${bump.oldRef}\\1(\\s*,\\s*)(['"\`])([^'"\`\\n]*)\\3`, 'g');
  const lines: number[] = [];
  const rewritten = text.replace(pattern, (_match, quote, separator, versionQuote, oldVersion, offset: number) => {
    lines.push(text.slice(0, offset).split('\n').length);
    return `${quote}${bump.newRef}${quote}${separator}${versionQuote}${version ?? oldVersion}${versionQuote}`;
  });
  return [rewritten, lines];
}

function carriesPin(text: string, bump: PinBump): boolean {
  return text.includes(`${bump.action}@${bump.newRef}`) || new RegExp(`['"\`]${bump.newRef}['"\`]`).test(text);
}

export function syncPins(
  sources: readonly SourceFile[],
  bumps: readonly PinBump[],
  versions: ReadonlyMap<string, string | undefined>,
): SyncResult {
  let files = [...sources];
  const rewrites: PinRewrite[] = [];
  const alreadyCarried: PinBump[] = [];
  const errors = findUnpinnedBumps(bumps);
  if (errors.length > 0) return { files, rewrites, alreadyCarried, errors };

  for (const bump of bumps) {
    const version = versions.get(bump.newRef);
    const locations: string[] = [];
    files = files.map((file) => {
      const [plain, plainLines] = rewritePlainPins(file.text, bump, version);
      const [typed, typedLines] = rewriteTypedPins(plain, bump, version);
      for (const line of [...plainLines, ...typedLines].sort((a, b) => a - b)) {
        locations.push(`${file.path}:${line}`);
      }
      return { path: file.path, text: typed };
    });

    if (locations.length > 0) {
      rewrites.push({ bump, version, locations });
    } else if (sources.some((file) => carriesPin(file.text, bump))) {
      alreadyCarried.push(bump);
    } else {
      errors.push(
        `${bump.action}@${bump.oldRef}: no source file pins it, so the sources and the generated workflow had already drifted`,
      );
    }
  }

  return { files, rewrites, alreadyCarried, errors };
}
