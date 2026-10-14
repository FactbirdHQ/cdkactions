import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as library from '@factbird/cdkactions';

import { findLocalDefinitions, type PinLookups, type SourceFile } from '#src/pin-sync.ts';

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

export const githubLookups: PinLookups = {
  async lsRemoteTags(repository) {
    return git(['ls-remote', '--tags', `https://github.com/${repository}`]);
  },
  async releaseExists(repository, tag) {
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'cdkactions-cli',
          ...(token && { authorization: `Bearer ${token}` }),
        },
      },
    );
    if (response.status === 200) return true;
    if (response.status === 404) return false;
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      const resetsAt = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : 'an unknown time';
      throw new Error(
        `GitHub's API rate limit stopped the release lookup for ${repository} ${tag}; it resets at ${resetsAt}. ` +
          'Set GITHUB_TOKEN or GH_TOKEN to raise the limit.',
      );
    }
    throw new Error(`Looking up release ${tag} of ${repository} returned HTTP ${response.status}`);
  },
};
