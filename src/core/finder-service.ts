import { EnvVarDict, PQueue, ServiceCaller } from '../core';
import { log } from '../util';
import { LocalDb } from '.';
import cli, { Table } from 'cli-ux';
import { OpsConfig } from 'ops-config';
import { EnvVarSource } from './envvar-interface';
import moment from 'moment';
import inquirer from 'inquirer';

function printOutput(finderDict: EnvVarDict) {
  const columns = {
    cloud: {
      extended: true,
    },
    source: {},
    key: {
      header: 'Key', // override column header
      minWidth: 10, // column must display at this width or greater
    },
    value: {},
  };

  const options = {
    columns: OpsConfig.get('output.columns'),
    sort: OpsConfig.get('output.sort'),
    filter: OpsConfig.get('output.filter'),
    csv: OpsConfig.get('output.csv'),
    extended: OpsConfig.get('output.extended'),
    'no-truncate': OpsConfig.get('output.noTruncate'),
    'no-header': OpsConfig.get('output.noHeader'),
  };

  const arrayOfObject: any[] = [];
  Object.values(finderDict).forEach((value) => {
    arrayOfObject.push(value);
  });

  cli.table(arrayOfObject, columns, options);
}

export class FinderService {
  // private parameters: FinderDict;
  private promiseQueue = new PQueue({
    interval: 1000,
    intervalCap: 40,
    concurrency: 10,
  });

  private cloudService: ServiceCaller[] = [];

  // eslint-disable-next-line no-useless-constructor
  constructor(private dB: LocalDb) {
    // this.parameters = {};
  }

  private async shouldRunRemoteWithUpdatedData(): Promise<boolean> {
    const metaData = await this.dB.getMetaDataFromDatabase();
    let runRemote = true;
    const momentDuration = OpsConfig.get('freshRemoteReminder');
    if (moment(metaData?.lastUpdated).add(momentDuration).isAfter(moment())) {
      const questions = [
        {
          type: 'confirm',
          name: 'input',
          message: `The cache was updated only ${moment(
            metaData?.lastUpdated
          ).fromNow()}, do you still want to fetch new remote state?`,
          default: true,
        },
      ];

      const { input } = await inquirer.prompt(questions);
      runRemote = input;
      if (runRemote) {
        log.noFormatting(
          'You can add the configuration "freshRemoteReminder:  duration (i.e. 10 minutes)"\nto change how long before we remind you the data is still fresh'
        );
        await cli.wait(500);
      } else {
        log.noFormatting(
          'Next time, you can use the option --no-remote to skip fetching remote state'
        );
        await cli.wait();
      }
    }

    return runRemote;
  }

  public addEnvVarSource(envVarSource: EnvVarSource) {
    this.cloudService.push(
      new ServiceCaller(this.promiseQueue, this.dB, envVarSource)
    );
  }

  public async runSearch(values: Array<string>, runRemote: boolean) {
    if (runRemote) {
      if (await this.shouldRunRemoteWithUpdatedData()) {
        cli.action.start('updating cache with remote data');
        await Promise.all(
          this.cloudService.map((value) => value.fetchAndUpdateDb())
        );
        cli.action.stop();
      }
    }
    // now that database is updated, iterate through database to find value
    const foundItems = await this.dB.findKeyInDatabaseForValue(values);
    log.noFormatting('\n');
    printOutput(foundItems);
  }

  public async runKeySearch(keys: string[], runRemote: boolean) {
    if (runRemote) {
      if (await this.shouldRunRemoteWithUpdatedData()) {
        cli.action.start('updating cache with remote data');
        await Promise.all(
          this.cloudService.map((value) => value.fetchAndUpdateDb())
        );
        cli.action.stop();
      }
    }
    // now that database is updated, iterate through database to find value
    const foundItems = await this.dB.findValueInDatabaseForKey(keys);
    log.prettyPrint('\n');
    printOutput(foundItems);
  }
}
