import {
  EnvVarArray,
  PQueue,
  ServiceCaller,
  UpdateRemoteStrategyReturnValue,
} from '../core';
import { log } from '../util';
import { LocalDb } from '.';
import cli, { Table } from 'cli-ux';
import { OpsConfig } from 'ops-config';
import { EnvVar, EnvVarService } from './envvar-interface';
import moment from 'moment';
import inquirer from 'inquirer';

function printOutput(envVarArray: EnvVarArray) {
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
    'no-truncate': OpsConfig.get('output.truncate'),
    'no-header': OpsConfig.get('output.header'),
  };

  cli.table(envVarArray, columns, options);
}

type EnvVarUpdateRemotePrintFormat = {
  status: 'success' | 'failed';
  raw?: any;
  error?: any;
} & EnvVar;

function printOverWriteResult(
  envVarRemoteValue: Array<EnvVarUpdateRemotePrintFormat>
) {
  const columns = {
    cloud: {
      extended: true,
    },
    source: {},
    key: {
      header: 'Key', // override column header
      minWidth: 10, // column must display at this width or greater
    },
    status: {},
    response: {
      get: (row: any) => {
        if (row?.error) {
          return JSON.stringify(row.error);
        }

        return JSON.stringify(row.raw);
      },
    },
  };

  const options = {
    columns: OpsConfig.get('output.columns'),
    sort: OpsConfig.get('output.sort'),
    filter: OpsConfig.get('output.filter'),
    csv: OpsConfig.get('output.csv'),
    extended: OpsConfig.get('output.extended'),
    'no-truncate': OpsConfig.get('output.truncate'),
    'no-header': OpsConfig.get('output.header'),
  };

  cli.table(envVarRemoteValue, columns, options);
}

async function queryUpdateChoices(
  writeValue: string,
  envVarArray: EnvVarArray,
  availableServices: Array<{ cloud: string; source: string }>
): Promise<EnvVarArray> {
  const choices: Array<{
    name: string;
    value: EnvVar;
    disabled: boolean;
  }> = envVarArray.map((envVar) => {
    const choice: any = {
      name: `${envVar.cloud}:${envVar.source} key: ${envVar.key} value: ${envVar.value}`,
      value: envVar,
    };
    const isServiceWritable = availableServices.some((service) => {
      const available =
        envVar.cloud === service.cloud && envVar.source === service.source;
      return available;
    });
    if (!isServiceWritable) {
      choice.disabled = 'cannot update remote';
    }
    return choice;
  });

  const result = await inquirer.prompt([
    {
      type: 'checkbox',
      message: `Please select variables to overwrite with ${writeValue}`,
      name: 'envVars',
      choices: choices,
      validate: function (answer) {
        if (answer.length === 0) {
          return 'Please choose at least one variable to overwrite (or press Ctrl-C to exit)';
        }

        return true;
      },
    },
  ]);

  return result.envVars;
}

export class FinderService {
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
    // if no interactive mode enabled, just return true and do not prompt
    if (OpsConfig.get('noInteractive')) return true;

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
        await cli.wait(500);
      }
    }

    return runRemote;
  }

  public addEnvVarSource(envVarSource: EnvVarService) {
    this.cloudService.push(
      new ServiceCaller(this.promiseQueue, this.dB, envVarSource)
    );
  }

  public getListOfWritableServices(): Array<{ cloud: string; source: string }> {
    const writableServices: Array<{
      cloud: string;
      source: string;
    }> = this.cloudService.reduce(
      (acc: Array<{ cloud: string; source: string }>, service) => {
        if (service.writable) {
          acc.push({ cloud: service.cloud, source: service.source });
        }
        return acc;
      },
      []
    );
    return writableServices;
  }

  public async runSearch(
    values: Array<string>,
    runRemote: boolean
  ): Promise<EnvVarArray> {
    if (runRemote) {
      if (await this.shouldRunRemoteWithUpdatedData()) {
        cli.action.start('updating cache with remote data');
        await Promise.all(
          this.cloudService.map((service) => service.fetchAndUpdateDb())
        );
        cli.action.stop();
      }
    }
    // now that database is updated, iterate through database to find value
    const foundItems = await this.dB.findKeyInDatabaseForValue(values);
    log.noFormatting('\n');
    printOutput(foundItems);

    return foundItems;
  }

  public async runKeySearch(keys: string[], runRemote: boolean) {
    if (runRemote) {
      if (await this.shouldRunRemoteWithUpdatedData()) {
        cli.action.start('updating cache with remote data');
        await Promise.all(
          this.cloudService.map((service) => service.fetchAndUpdateDb())
        );
        cli.action.stop();
      }
    }
    // now that database is updated, iterate through database to find value
    const foundItems = await this.dB.findValueInDatabaseForKey(keys);
    log.noFormatting('\n');
    printOutput(foundItems);

    return foundItems;
  }

  public async runOverWrite(value: string, envVarArray: EnvVarArray) {
    // confirm overWrite
    let updateEnvVars = envVarArray;
    if (!OpsConfig.get('noInteractive')) {
      const writableServices = this.getListOfWritableServices();
      updateEnvVars = await queryUpdateChoices(
        value,
        envVarArray,
        writableServices
      );
    }

    cli.action.start(`updating remote data with new value "${value}"`);
    const result = await Promise.all(
      this.cloudService.map((service) =>
        service.updateRemote(value, updateEnvVars)
      )
    );
    cli.action.stop();

    // format result
    // merge success and failed from all promises
    let success: Array<{ envVar: EnvVar; raw: any }> = [];
    let failed: Array<{ envVar: EnvVar; error: any }> = [];
    result.forEach((element) => {
      if (element) {
        success = success.concat(element.success);
        failed = failed.concat(element.failed);
      }
    });
    const formattedOutput: Array<EnvVarUpdateRemotePrintFormat> = [];
    success.forEach((element) => {
      const envPrint: EnvVarUpdateRemotePrintFormat = {
        ...element.envVar,
        status: 'success',
        raw: element.raw,
      };
      formattedOutput.push(envPrint);
    });

    failed.forEach((element) => {
      const envPrint: EnvVarUpdateRemotePrintFormat = {
        ...element.envVar,
        status: 'failed',
        error: element.error,
      };
      formattedOutput.push(envPrint);
    });

    // save to database
    const updateEnvVarsInDb = success.map((element) => element.envVar);
    await this.dB.saveToDatabase(updateEnvVarsInDb);

    // print overwrite result
    log.noFormatting('\n');
    printOverWriteResult(formattedOutput);
  }
}
