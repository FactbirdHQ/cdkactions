import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import init from './cmds/init.js';
import synth from './cmds/synth.js';

yargs(hideBin(process.argv)).command(synth).command(init).demandCommand(1).parse();
