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
    log.noFormatting('\n');
    log.noFormatting(
      `Cache location : ${path.dirname(this.cacheLocation as string)}`
    );
    log.noFormatting(
      `Available caches : ${cacheDirContent.toString().replace(/,/g, ', ')}`
    );
    log.noFormatting(
      `Currently used cache : ${path.basename(this.cacheLocation as string)}`
    );
    log.noFormatting(`Total cache data count : ${metaData.count}`);
    log.noFormatting(`Cache last updated ${metaData.lastUpdated}`);
    log.noFormatting('\n');
    cli.table(printSources, columns);
    log.noFormatting('\n');
    log.noFormatting(
      `Config file search location : ${path.dirname(configFile)}`
    );
    log.noFormatting(
      `Available config files : ${configDirContent
        .toString()
        .replace(/,/g, ', ')}`
    );
    log.noFormatting(
      `Currently used config file : ${path.basename(configFile)}`
    );
    log.noFormatting('Current configuration : \n');
    log.noFormatting(OpsConfig.printValues());
    log.noFormatting('\n');
    log.noFormatting(
      `Dotenv file search location : ${path.dirname(configFile)}`
    );
    log.noFormatting(
      `Available dotenv files : ${dotenvDirContent
        .toString()
        .replace(/,/g, ', ')}`
    );
    if (dotenvFile) {
      log.noFormatting(
        `Currently used dotenv file : ${path.basename(dotenvFile)}`
      );
    }
  }
}
