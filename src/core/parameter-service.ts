// import { AWSSystemsManager, NetworkResultArray } from '../aws-services';
import { AWSSystemsManager } from '../aws-services';
import { LogManager } from '../util';
import { LocalDb } from '../core';
import moment from 'moment';
// import { logger, LogManager } from '../util';

// const log = logger.child({ class: 'ParameterService' });

// const jsonLog = LogManager.loggers.get('jsonFile');
const outputLog = LogManager.Instance.loggers.get('output');

export enum ParameterDatabaseSyncEnum {
  EXIST_NOT_SYNCED = 0,
  EXIST_SYNCED = 1,
  NO_EXIST = 2,
}

interface ParameterNetworkStatus {
  statusCode: number;
  data: object;
}

export interface Parameter {
  key: string;
  value?: string;
  modifiedDate?: string;
  source?: string;
  syncStatus?: ParameterDatabaseSyncEnum;
  networkStatus?: ParameterNetworkStatus;
}

export interface ParameterDict {
  [key: string]: Parameter;
}

export class ParameterService {
  // private parameters: ParameterDict;

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private localDBService: LocalDb,
    private cloudService: AWSSystemsManager = new AWSSystemsManager()
  ) {
    // this.parameters = {};
  }

  private compareRemoteWithDatabase(
    remote: ParameterDict,
    database: ParameterDict
  ): Array<string> {
    const getParameterList: Array<string> = [];
    Object.keys(remote).forEach((value) => {
      const databaseParameter = database[value];
      if (databaseParameter) {
        const isSame = moment(databaseParameter.modifiedDate).isSame(
          remote[value].modifiedDate
        );
        if (!isSame) {
          getParameterList.push(value);
        }
      } else {
        getParameterList.push(value);
      }
    });
    return getParameterList;
  }

  public async runSearch(values: Array<string>, runRemote: boolean) {
    // get database
    const databaseParameters = await this.localDBService.getAllDatabaseItems();

    if (runRemote) {
      // get network
      const remoteParameters = await this.cloudService.getAllEnvVars();
      // compare database and network, and get list of items not in database
      const getList = await this.compareRemoteWithDatabase(
        remoteParameters,
        databaseParameters
      );

      // keep on retrying as long as there is still something in failed list
      // should fix this in the future
      let failedList: Array<string> | null = null;
      do {
        let result;
        if (failedList === null) {
          // eslint-disable-next-line no-await-in-loop
          result = await this.cloudService.getEnvVarValues(getList);
        } else {
          // eslint-disable-next-line no-await-in-loop
          result = await this.cloudService.getEnvVarValues(failedList);
        }
        failedList = result?.failedList;
        if (result?.parameters !== null) {
          // save to database
          this.localDBService.saveToDatabase(result?.parameters, 'ssm');
        }
      } while (failedList !== null);
    }

    // now that database is updated, iterate through database to find value
    const foundItems = await this.localDBService.findKeyInDatabaseForValue(
      values,
      Object.keys(databaseParameters).length
    );
    outputLog.info(foundItems);
  }

  public async runKeySearch(keys: string[], runRemote: boolean) {
    // get database
    const databaseParameters = await this.localDBService.getAllDatabaseItems();

    if (runRemote) {
      // get network
      const remoteParameters = await this.cloudService.getAllEnvVars();
      // compare database and network, and get list of items not in database
      const getList = await this.compareRemoteWithDatabase(
        remoteParameters,
        databaseParameters
      );

      // keep on retrying as long as there is still something in failed list
      // should fix this in the future
      let failedList: Array<string> | null = null;
      do {
        let result;
        if (failedList === null) {
          // eslint-disable-next-line no-await-in-loop
          result = await this.cloudService.getEnvVarValues(getList);
        } else {
          // eslint-disable-next-line no-await-in-loop
          result = await this.cloudService.getEnvVarValues(failedList);
        }
        failedList = result?.failedList;
        if (result?.parameters !== null) {
          // save to database
          this.localDBService.saveToDatabase(result?.parameters, 'ssm');
        }
      } while (failedList !== null);
    }

    // now that database is updated, iterate through database to find value
    const foundItems = await this.localDBService.findValueInDatabaseForKey(
      keys,
      Object.keys(databaseParameters).length
    );
    outputLog.info(foundItems);
  }
}
