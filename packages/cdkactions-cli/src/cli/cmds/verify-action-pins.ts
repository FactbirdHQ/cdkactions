import type * as yargs from 'yargs';

import { actionHelpers, readSources } from '#src/cli/pin-sources.ts';
import { findSourcePins, verifyPins } from '#src/pin-sync.ts';

class Command implements yargs.CommandModule {
  public readonly command = 'verify-action-pins <sources..>';
  public readonly describe =
    'Checks that every action pinned to a commit with a version has that version tag pointing at the commit.';

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
    const { problems, verified, unversioned } = verifyPins(pins);
    for (const pin of unversioned) {
      console.log(
        `${pin.file}:${pin.line}: ${pin.action ?? pin.helper}@${pin.ref} has no version, so it is not checked`,
      );
    }
    if (problems.length > 0) {
      for (const problem of problems) console.error(`ERROR: ${problem}`);
      process.exit(1);
    }
    console.log(`${verified.length} versioned pin(s) checked: each tag points at its pinned commit.`);
  }
}

export default new Command();
