import type * as yargs from 'yargs';

import { actionHelpers, githubLookups, readSources } from '#src/cli/pin-sources.ts';
import { findSourcePins, verifyPins } from '#src/pin-sync.ts';

class Command implements yargs.CommandModule {
  public readonly command = 'verify-action-pins <sources..>';
  public readonly describe =
    'Checks that every action pinned to a commit names a GitHub release whose tag points at that commit.';

  public readonly builder = (args: yargs.Argv) =>
    args.positional('sources', {
      type: 'string',
      array: true,
      desc: 'Source files or globs that pin actions',
    });

  public async handler(argv: any) {
    const sources = readSources(argv.sources);
    const helpers = actionHelpers(sources);
    const pins = sources.flatMap((file) => findSourcePins(file, helpers));
    const problems = await verifyPins(pins, githubLookups);
    if (problems.length > 0) {
      for (const problem of problems) console.error(`ERROR: ${problem}`);
      process.exit(1);
    }
    const commitPins = pins.filter((pin) => /^[0-9a-f]{40}$/.test(pin.ref));
    console.log(`${commitPins.length} pins name a release whose tag points at the pinned commit.`);
  }
}

export default new Command();
