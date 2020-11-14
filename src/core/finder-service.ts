import { EnvVarDict, PQueue, ServiceCaller } from '../core';
import { log } from '../util';
import { LocalDb } from '.';
import cli, { Table } from 'cli-ux';
import { OpsConfig } from 'ops-config';
import { EnvVarSource } from './envvar-interface';

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
  constructor(private localDBService: LocalDb) {
    // this.parameters = {};
  }

  public addEnvVarSource(envVarSource: EnvVarSource) {
    this.cloudService.push(
      new ServiceCaller(this.promiseQueue, this.localDBService, envVarSource)
    );
  }

  public async runSearch(values: Array<string>, runRemote: boolean) {
    if (runRemote) {
      cli.action.start('updating cache with remote data');
      await Promise.all(
        this.cloudService.map((value) => value.fetchAndUpdateDb())
      );
      cli.action.stop();
    }
    // now that database is updated, iterate through database to find value
    const foundItems = await this.localDBService.findKeyInDatabaseForValue(
      values
    );
    log.noFormatting('\n');
    printOutput(foundItems);
  }

  public async runKeySearch(keys: string[], runRemote: boolean) {
    if (runRemote) {
      cli.action.start('updating cache with remote data');
      await Promise.all(
        this.cloudService.map((value) => () => value.fetchAndUpdateDb())
      );
      cli.action.stop();
    }

    // now that database is updated, iterate through database to find value
    const foundItems = await this.localDBService.findValueInDatabaseForKey(
      keys
    );
    log.prettyPrint('\n');
    printOutput(foundItems);
  }
}
