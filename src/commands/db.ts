import Command from '../base';
import { flags } from '@oclif/command';
import { CredentialManager } from '../core';
import { log } from '../util';
import { FinderService } from '../core';
import { OpsConfig } from 'ops-config';
import cli from 'cli-ux';
import { AWSParameterStore, AWSRoute53 } from '../aws-services';
import inquirer from 'inquirer';
import { schema } from '../schema';

export default class Db extends Command {
  static description = 'Print cache data and diagnostics';

  static strict = false;

  static flags = {
    ...Command.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
  };

  static args = [];

  async run() {
    log.debug('starting program');
    const { flags } = this.parse(Db);

    const metaData = await this.getDb().updateMetaData();
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
    log.noFormatting('\n');
    log.noFormatting(`Total cache data count : ${metaData.count}`);
    log.noFormatting(`Cache last updated ${metaData.lastUpdated}`);
    log.noFormatting('\n');
    cli.table(printSources, columns);
  }
}
