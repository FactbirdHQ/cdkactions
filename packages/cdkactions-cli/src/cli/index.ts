import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import init from '#src/cli/cmds/init.ts';
import synth from '#src/cli/cmds/synth.ts';

yargs(hideBin(process.argv)).command(synth).command(init).demandCommand(1).parse();
