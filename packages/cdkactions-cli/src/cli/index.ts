import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import init from '#src/cli/cmds/init.ts';
import synth from '#src/cli/cmds/synth.ts';
import syncActionPins from '#src/cli/cmds/sync-action-pins.ts';

yargs(hideBin(process.argv)).command(synth).command(init).command(syncActionPins).demandCommand(1).parse();
