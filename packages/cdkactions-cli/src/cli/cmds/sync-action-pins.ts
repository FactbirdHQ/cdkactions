import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import type * as yargs from 'yargs';

import {
  actionRepository,
  findUnpinnedBumps,
  parseWorkflowBumps,
  resolveVersion,
  type SourceFile,
  syncPins,
} from '#src/pin-sync.ts';

const GLOB_CHARACTERS = /[*?[{]/;

function expandSources(patterns: readonly string[]): string[] {
  const files = patterns.flatMap((pattern) => (GLOB_CHARACTERS.test(pattern) ? fs.globSync(pattern) : [pattern]));
  return [...new Set(files)].sort();
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

class Command implements yargs.CommandModule {
  public readonly command = 'sync-action-pins <sources..>';
  public readonly describe =
    "Carries the action pins Dependabot moved in generated cdkactions_*.yaml workflows into the TypeScript sources they're synthesized from.";

  public readonly builder = (args: yargs.Argv) =>
    args
      .positional('sources', {
        type: 'string',
        array: true,
        desc: 'Source files or globs that pin actions',
      })
      .option('base', {
        type: 'string',
        required: true,
        desc: 'Ref to diff the generated workflows against, such as the pull request base SHA',
      })
      .option('workflows', {
        type: 'string',
        default: '.github/workflows',
        desc: 'Directory holding the generated workflows',
      });

  public async handler(argv: any) {
    const bumps = parseWorkflowBumps(git(['diff', '--no-color', argv.base, '--', argv.workflows]));
    if (bumps.length === 0) {
      console.log(`No action pins moved in ${argv.workflows} since ${argv.base}.`);
      return;
    }

    const unpinned = findUnpinnedBumps(bumps);
    if (unpinned.length > 0) {
      for (const error of unpinned) console.error(`ERROR: ${error}`);
      process.exit(1);
    }

    const sources: SourceFile[] = expandSources(argv.sources).map((file) => ({
      path: file,
      text: fs.readFileSync(file, 'utf-8'),
    }));

    const versions = new Map<string, string | undefined>();
    for (const bump of bumps) {
      if (versions.has(bump.newRef)) continue;
      const tags = git(['ls-remote', '--tags', `https://github.com/${actionRepository(bump.action)}`]);
      versions.set(bump.newRef, resolveVersion(tags, bump.newRef));
    }

    const result = syncPins(sources, bumps, versions);
    if (result.errors.length > 0) {
      for (const error of result.errors) console.error(`ERROR: ${error}`);
      process.exit(1);
    }

    for (const file of result.files) {
      const original = sources.find((source) => source.path === file.path);
      if (original?.text !== file.text) fs.writeFileSync(file.path, file.text);
    }
    for (const { bump, version, locations } of result.rewrites) {
      const label = version ?? 'no release tag points at this commit, version left as it was';
      console.log(`${bump.action} ${bump.oldRef} -> ${bump.newRef} (${label})`);
      for (const location of locations) console.log(`  ${location}`);
    }
    for (const bump of result.alreadyCarried) {
      console.log(`${bump.action} ${bump.newRef}: the sources already pin it`);
    }
  }
}

export default new Command();
