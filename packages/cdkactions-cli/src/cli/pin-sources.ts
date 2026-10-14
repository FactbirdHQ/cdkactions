import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as library from '@factbird/cdkactions';

import { findLocalDefinitions, type SourceFile } from '#src/pin-sync.ts';

const GLOB_CHARACTERS = /[*?[{]/;

export function readSources(patterns: readonly string[]): SourceFile[] {
  const files = patterns.flatMap((pattern) => (GLOB_CHARACTERS.test(pattern) ? fs.globSync(pattern) : [pattern]));
  return [...new Set(files)].sort().map((file) => ({ path: file, text: fs.readFileSync(file, 'utf-8') }));
}

export function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

/** The action behind each typed helper: the library's, such as `checkoutV7`, and the sources' own. */
export function actionHelpers(sources: readonly SourceFile[]): Map<string, string> {
  const helpers = new Map<string, string>();
  for (const [name, value] of Object.entries(library)) {
    if (typeof value === 'function' && 'pinned' in value && 'ref' in value && typeof value.ref === 'string') {
      helpers.set(name, value.ref.slice(0, value.ref.lastIndexOf('@')));
    }
  }
  for (const [name, action] of findLocalDefinitions(sources)) helpers.set(name, action);
  return helpers;
}
