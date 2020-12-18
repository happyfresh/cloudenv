import Command from '../base';
import { flags } from '@oclif/command';
import { log } from '../util';
import { OpsConfig } from 'ops-config';
import cli from 'cli-ux';
import chalk from 'chalk';
import { schema } from '../schema';
import path from 'path';
import fs from 'fs';

export default class Info extends Command {
  static description = 'Print cache data and diagnostics';

  static strict = false;

  static flags = {
    ...Command.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    schema: flags.boolean({ default: false }),
  };

  static args = [];

  async run() {
    log.debug('starting program');
    const { flags } = this.parse(Info);

    if (flags.schema) {
      log.noFormatting(JSON.stringify(schema, undefined, 2));
      return;
    }

    const passwordOk = await this.getDb().unlockDatabase(
      this.password as string
    );

    let metaData: any;

    if (passwordOk) {
      metaData = await this.getDb().updateMetaData();
      log.noFormatting('\n');
    }

    const configFile = OpsConfig.printConfigPathPriority().find(
      (path) => path.absolute && path.conditionPass
    )?.description as string;
    const configDir = fs.readdirSync(path.dirname(configFile));
    const configDirContent = configDir.filter(
      (file) => file.includes('.yml') || file.includes('.yaml')
    );
    const dotenvFile = OpsConfig.printDotenvPathPriority().find(
      (path) => path.absolute && path.conditionPass
    )?.description as string;
    const dotenvDirContent = configDir.filter((file) => file[0] === '.');
    const cacheDirContent = fs.readdirSync(
      path.dirname(this.cacheLocation as string)
    );
    cli.table(
      [
        {
          item: chalk.blue('Cache location'),
          separator: ':',
          description: path.dirname(this.cacheLocation as string),
        },
        {
          item: chalk.blue('Available caches'),
          separator: ':',
          description: cacheDirContent.toString().replace(/,/g, ', '),
        },
        {
          item: chalk.blue('Currently used cache'),
          separator: ':',
          description: path.basename(this.cacheLocation as string),
        },
      ],
      { item: {}, separator: {}, description: {} },
      { 'no-header': true, 'no-truncate': true }
    );
    if (passwordOk) {
      const printSources = Object.keys(metaData.source).map((element) => {
        return {
          source: element,
          count: metaData.source[element].count,
          lastUpdated: metaData.source[element].lastUpdated,
        };
      });
      const columns = {
        source: {},
        count: {},
        lastUpdated: {},
      };
      log.noFormatting('');
      log.noFormatting(`Cache last updated ${metaData.lastUpdated}`);
      if (printSources.length !== 0) {
        log.noFormatting('');
        cli.table(printSources, columns);
      }
    }
    log.noFormatting('');
    cli.table(
      [
        {
          item: chalk.blue('Config file search location'),
          separator: ':',
          description: path.dirname(configFile),
        },
        {
          item: chalk.blue('Available config files'),
          separator: ':',
          description: configDirContent.toString().replace(/,/g, ', '),
        },
        {
          item: chalk.blue('Currently used config file'),
          separator: ':',
          description: path.basename(configFile),
        },
      ],
      { item: {}, separator: {}, description: {} },
      { 'no-header': true, 'no-truncate': true }
    );

    log.noFormatting('Current configuration : \n');
    log.noFormatting(OpsConfig.printValues());
    log.noFormatting('');

    cli.table(
      [
        {
          item: chalk.blue('Dotenv file search location'),
          separator: ':',
          description: path.dirname(configFile),
        },
        {
          item: chalk.blue('Available dotenv files'),
          separator: ':',
          description: dotenvDirContent.toString().replace(/,/g, ', '),
        },
        {
          item: chalk.blue('Currently used dotenv file'),
          separator: ':',
          description: dotenvFile ? path.basename(dotenvFile) : 'None',
        },
      ],
      { item: {}, separator: {}, description: {} },
      { 'no-header': true, 'no-truncate': true }
    );
  }
}
