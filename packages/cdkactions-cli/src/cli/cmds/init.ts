import * as path from 'node:path';

import fs from 'fs-extra';
import type * as yargs from 'yargs';

class Command implements yargs.CommandModule {
  public readonly command = 'init TYPE';
  public readonly describe = 'Create a new cdkactions project from a template.';
  public readonly builder = (args: yargs.Argv) =>
    args
      .positional('TYPE', { demandOption: true, desc: 'Project type' })
      .showHelpOnFail(true)
      .option('cdkactions-version', {
        type: 'string',
        desc: 'The cdkactions version to use when creating the new project',
      });

  public async handler(argv: any) {
    if (fs.readdirSync('.').filter((f: string) => !f.startsWith('.')).length > 0) {
      console.error('Cannot initialize a project in a non-empty directory');
      process.exit(1);
    }

    console.error(`Initializing a project from the ${argv.TYPE} template`);
  }
}

async function determineDeps(version: string, dist?: string): Promise<Deps> {
  if (dist) {
    const ret = {
      npm_cdkactions: path.resolve(dist, 'js', `cdkactions@${version}.jsii.tgz`),
      npm_cdkactions_cli: path.resolve(dist, 'js', `cdkactions-cli-v${version}.tgz`),
    };

    for (const file of Object.values(ret)) {
      if (!(await fs.pathExists(file))) {
        throw new Error(`unable to find ${file} under the "dist" directory (${dist})`);
      }
    }

    return {
      ...ret,
      cdkactions_version: version,
    };
  }

  if (version === '0.0.0') {
    throw new Error('cannot use version 0.0.0, use --cdkactions-version');
  }

  const ver = version.includes('-') ? version : `^${version}`;

  return {
    npm_cdkactions: `@factbird/cdkactions@${ver}`,
    npm_cdkactions_cli: `@factbird/cdkactions-cli@${ver}`,
    cdkactions_version: version,
  };
}

interface Deps {
  npm_cdkactions: string;
  npm_cdkactions_cli: string;
  cdkactions_version: string;
}

export default new Command();
