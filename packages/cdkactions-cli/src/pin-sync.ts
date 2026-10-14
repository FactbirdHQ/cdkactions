import * as path from 'node:path';

import {
  actionRepository,
  checkPinnedActions,
  type GitHubTags,
  gitHubTags,
  parseTagCommits,
} from '@factbird/cdkactions';

export interface PinBump {
  readonly action: string;
  readonly oldRef: string;
  readonly newRef: string;
}

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

interface TextRange {
  readonly start: number;
  readonly end: number;
}

/**
 * An action reference in a source file: the plain `'<action>@<ref>', // <version>` string, or the
 * typed `<helper>.pinned('<ref>', '<version>')` call.
 */
export interface SourcePin {
  readonly file: string;
  readonly line: number;
  readonly form: 'plain' | 'typed';
  /** `owner/repo[/path]`; undefined for a typed pin whose helper is not a known action. */
  readonly action: string | undefined;
  readonly helper?: string;
  readonly ref: string;
  readonly refRange: TextRange;
  readonly version: string | undefined;
  readonly versionRange?: TextRange;
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
  /**
   * Bumps of a pin the library owns, such as a `DependabotActionPinSync` step left at its default.
   * No source edit moves those, so a resynth would write the old pin back.
   */
  readonly libraryOwned: readonly PinBump[];
  readonly errors: readonly string[];
}

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const USES_LINE = /^([+-])\s*(?:-\s+)?uses:\s*["']?([^@\s"']+)@([^\s"'#]+)/;
const GENERATED_WORKFLOW = /^cdkactions_.*\.ya?ml$/;
const SEMVER_TAG = /^v?\d+(?:\.\d+){0,2}$/;
const PLAIN_PIN = /(['"`])((?:[\w.-]+\/)+[\w.-]+)@([\w.-]+)\1/g;
const TRAILING_VERSION_COMMENT = /\/\/\s*(v?\d\S*)\s*$/;
const TYPED_PIN = /([A-Za-z_$][\w$]*)\s*\.pinned\(\s*(['"`])([^'"`\s]+)\2\s*(?:,\s*(['"`])([^'"`\n]*)\4\s*)?,?\s*\)/g;
const LOCAL_DEFINITION =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*defineAction\s*(?:<[\s\S]*?>)?\s*\(\s*(['"`])([^'"`@]+)@[^'"`]*\2/g;

function isRemoteAction(action: string): boolean {
  return !action.startsWith('./') && !action.startsWith('docker://') && action.split('/').length >= 2;
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
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

export { actionRepository };

export function findUnpinnedBumps(bumps: readonly PinBump[]): string[] {
  return bumps
    .filter((bump) => !COMMIT_SHA.test(bump.newRef))
    .map((bump) => `${bump.action}: moved to '${bump.newRef}', which is not a 40-character commit SHA`);
}

/** Maps each `defineAction` declared in the sources to its action, without the `@ref`. */
export function findLocalDefinitions(sources: readonly SourceFile[]): Map<string, string> {
  const definitions = new Map<string, string>();
  for (const file of sources) {
    for (const match of file.text.matchAll(LOCAL_DEFINITION)) definitions.set(match[1], match[3]);
  }
  return definitions;
}

/**
 * Finds every action reference in a source file. `helpers` maps the name of a typed action, such
 * as `checkoutV7`, to its action, so a typed pin knows what it pins.
 */
export function findSourcePins(file: SourceFile, helpers: ReadonlyMap<string, string>): SourcePin[] {
  const pins: SourcePin[] = [];

  for (const match of file.text.matchAll(PLAIN_PIN)) {
    const [whole, , action, ref] = match;
    const start = match.index ?? 0;
    const refStart = start + whole.lastIndexOf(ref);
    const lineEnd = file.text.indexOf('\n', start + whole.length);
    const restStart = start + whole.length;
    const rest = file.text.slice(restStart, lineEnd < 0 ? undefined : lineEnd);
    const comment = TRAILING_VERSION_COMMENT.exec(rest);
    const versionStart = comment ? restStart + (comment.index ?? 0) + comment[0].indexOf(comment[1]) : undefined;
    pins.push({
      file: file.path,
      line: lineAt(file.text, start),
      form: 'plain',
      action,
      ref,
      refRange: { start: refStart, end: refStart + ref.length },
      version: comment?.[1],
      ...(versionStart !== undefined && {
        versionRange: { start: versionStart, end: versionStart + (comment?.[1].length ?? 0) },
      }),
    });
  }

  for (const match of file.text.matchAll(TYPED_PIN)) {
    const [whole, helper, quote, ref, versionQuote, version] = match;
    const start = match.index ?? 0;
    const refStart = start + whole.indexOf(`${quote}${ref}${quote}`) + 1;
    const versionStart =
      version === undefined ? undefined : start + whole.lastIndexOf(`${versionQuote}${version}${versionQuote}`) + 1;
    pins.push({
      file: file.path,
      line: lineAt(file.text, refStart),
      form: 'typed',
      action: helpers.get(helper),
      helper,
      ref,
      refRange: { start: refStart, end: refStart + ref.length },
      version,
      ...(version !== undefined &&
        versionStart !== undefined && { versionRange: { start: versionStart, end: versionStart + version.length } }),
    });
  }

  return pins.sort((a, b) => a.refRange.start - b.refRange.start);
}

/** The most specific semver tag at `sha`, so `v7.0.1` wins over `v7`. */
export function resolveVersion(lsRemoteOutput: string, sha: string): string | undefined {
  const candidates = [...parseTagCommits(lsRemoteOutput)]
    .filter(([tag, commit]) => commit === sha && SEMVER_TAG.test(tag))
    .map(([tag]) => tag);
  candidates.sort((a, b) => b.split('.').length - a.split('.').length || a.localeCompare(b));
  return candidates[0];
}

function pinsBump(pin: SourcePin, bump: PinBump, ref: string): boolean {
  if (pin.ref !== ref) return false;
  return pin.form === 'plain' ? pin.action === bump.action : pin.action === undefined || pin.action === bump.action;
}

function applyEdits(text: string, edits: Array<TextRange & { readonly value: string }>): string {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  }
  return result;
}

export function syncPins(
  sources: readonly SourceFile[],
  bumps: readonly PinBump[],
  versions: ReadonlyMap<string, string | undefined>,
  helpers: ReadonlyMap<string, string> = new Map(),
  libraryPins: ReadonlySet<string> = new Set(),
): SyncResult {
  let files = [...sources];
  const rewrites: PinRewrite[] = [];
  const alreadyCarried: PinBump[] = [];
  const libraryOwned: PinBump[] = [];
  const errors = findUnpinnedBumps(bumps);
  if (errors.length > 0) return { files, rewrites, alreadyCarried, libraryOwned, errors };

  for (const bump of bumps) {
    const version = versions.get(bump.newRef);
    const locations: string[] = [];
    let carried = false;
    files = files.map((file) => {
      const pins = findSourcePins(file, helpers);
      carried ||= pins.some((pin) => pinsBump(pin, bump, bump.newRef));
      const edits = pins
        .filter((pin) => pinsBump(pin, bump, bump.oldRef))
        .flatMap((pin) => {
          locations.push(`${file.path}:${pin.line}`);
          const refEdit = { ...pin.refRange, value: bump.newRef };
          return version !== undefined && pin.versionRange
            ? [refEdit, { ...pin.versionRange, value: version }]
            : [refEdit];
        });
      return { path: file.path, text: applyEdits(file.text, edits) };
    });

    const ownedByLibrary = libraryPins.has(`${bump.action}@${bump.oldRef}`);
    if (ownedByLibrary) libraryOwned.push(bump);
    if (locations.length > 0) {
      rewrites.push({ bump, version, locations });
    } else if (ownedByLibrary) {
      // Reported through libraryOwned; no source holds it, so it is neither carried nor drift.
    } else if (carried) {
      alreadyCarried.push(bump);
    } else {
      errors.push(
        `${bump.action}@${bump.oldRef}: no source file pins it, so the sources and the generated workflow had already drifted`,
      );
    }
  }

  return { files, rewrites, alreadyCarried, libraryOwned, errors };
}

export function describeLibraryOwnedBump(bump: PinBump): string {
  return (
    `${bump.action} ${bump.oldRef} -> ${bump.newRef}: a DependabotActionPinSync step runs this action at the ` +
    `cdkactions library's pin rather than a source pin, so a resynth would write ${bump.oldRef} back into its workflow. ` +
    "Pass the action through the construct's `actions` prop, or wait for a cdkactions release that ships the new pin."
  );
}

export interface PinVerification {
  readonly problems: readonly string[];
  readonly verified: readonly SourcePin[];
  /** Pins to a commit without a version, which name no tag to check. */
  readonly unversioned: readonly SourcePin[];
}

/**
 * Requires each versioned pin's tag to point at its SHA, through the library's `checkPinnedActions`.
 * Unlike `App.synth()`, an unreachable GitHub is a failure here, since the check is the point.
 */
export function verifyPins(pins: readonly SourcePin[], tags: GitHubTags = gitHubTags): PinVerification {
  const commitPins = pins.filter((pin) => COMMIT_SHA.test(pin.ref));
  const unversioned = commitPins.filter((pin) => pin.version === undefined);
  const versioned = commitPins.filter((pin) => pin.version !== undefined);
  const problems: string[] = [];
  const checkable: SourcePin[] = [];
  for (const pin of versioned) {
    if (pin.action === undefined) {
      problems.push(
        `${pin.file}:${pin.line}: ${pin.helper}.pinned('${pin.ref}') is not a known action, so its tag cannot be checked`,
      );
    } else {
      checkable.push(pin);
    }
  }

  const result = checkPinnedActions(
    checkable.map((pin) => ({ action: pin.action ?? '', sha: pin.ref, version: pin.version })),
    tags,
  );
  if (!result.reachable) {
    problems.push(`GitHub is unreachable, so ${result.unverified.length} versioned pin(s) could not be verified`);
    return { problems, verified: [], unversioned };
  }

  const failing = new Set<SourcePin>();
  for (const problem of result.problems) {
    for (const pin of checkable) {
      if (pin.action === problem.pin.action && pin.ref === problem.pin.sha && pin.version === problem.pin.version) {
        failing.add(pin);
        problems.push(`${pin.file}:${pin.line}: ${problem.message}`);
      }
    }
  }
  return { problems, verified: checkable.filter((pin) => !failing.has(pin)), unversioned };
}
