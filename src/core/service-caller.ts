/* eslint-disable no-await-in-loop */
import {
  EnvVarService,
  ReadCapabilityOfService,
  PQueue,
  GetEnvVarReturnValue,
  EnvVarArray,
  PutEnvVarReturnValue,
  WriteCapabilityOfService,
  EnvVar,
} from './envvar-interface';
import { LocalDb } from './local-db';
import { log } from '../util';
import moment from 'moment';
import cli, { Table } from 'cli-ux';
import { OpsConfig } from 'ops-config';

/* export enum CapabilityOfEnvVarSource {
  GET_ALL_ONLY = 0,
  CHECK_MODIFIED_AND_SPECIFIC,
} */

export type UpdateDatabaseStrategy = (
  promiseQueue: PQueue,
  dB: LocalDb,
  service: EnvVarService
) => Promise<void> | never;

export type UpdateRemoteStrategy = (
  promiseQueue: PQueue,
  service: EnvVarService,
  overWriteValue: string,
  envVars: EnvVarArray
) => Promise<UpdateRemoteStrategyReturnValue>;

export interface UpdateRemoteStrategyReturnValue {
  success: Array<{ envVar: EnvVar; raw: any }>;
  failed: Array<{ envVar: EnvVar; error: any }>;
}

// This strategy gets all remote items and update's the database
const getAllAndFillStrategy: UpdateDatabaseStrategy = async (
  promiseQueue: PQueue,
  dB: LocalDb,
  service: EnvVarService
): Promise<void> => {
  if (!service.getAllEnvVars) {
    throw new Error(`getAllEnvVars is not defined for service ${service}`);
  }
  let resultArray: EnvVarArray = [];
  let nextToken;
  do {
    log.http(`requesting ${service.cloud}:${service.source} resources`);
    const result: GetEnvVarReturnValue = await service.getAllEnvVars(
      promiseQueue,
      nextToken
    );
    nextToken = result.nextToken;
    resultArray = resultArray.concat(result.envVarArray);
    result.envVarArray.forEach((envVar) => {
      log.http(`received ${service.cloud}:${service.source} ${envVar.key}`);
    });
  } while (nextToken);

  await dB.saveToDatabase(resultArray);
};

const compareRemoteWithDatabase = (
  remote: EnvVarArray,
  database: EnvVarArray
): Array<string> => {
  const getFinderList: Array<string> = [];
  remote.forEach((value) => {
    const databaseFinder = database.find((envVar) => envVar.key === value.key);
    if (databaseFinder) {
      const isSame = moment(databaseFinder.modifiedDate).isSame(
        value.modifiedDate
      );
      if (!isSame) {
        getFinderList.push(value.key);
      }
    } else {
      getFinderList.push(value.key);
    }
  });
  return getFinderList;
};

// This strategy check's the remote's last modified value
// and fetches and updates only items which were modified
const checkModifiedAndUpdateStrategy: UpdateDatabaseStrategy = async (
  promiseQueue: PQueue,
  dB: LocalDb,
  service: EnvVarService
): Promise<void> => {
  if (!service.checkModifiedEnvVars) {
    throw new Error(
      `checkModifiedEnvVars is not defined for service ${service}`
    );
  }

  if (!service.getEnvVars) {
    throw new Error(`getEnvVars is not defined for service ${service}`);
  }

  // check if there are any modified env vars
  let resultArray: EnvVarArray = [];
  let modifiedNextToken;
  do {
    log.http(`requesting ${service.cloud}:${service.source} modified state`);
    const result: GetEnvVarReturnValue = await service.checkModifiedEnvVars(
      promiseQueue,
      modifiedNextToken
    );
    modifiedNextToken = result.nextToken;
    resultArray = resultArray.concat(result.envVarArray);
  } while (modifiedNextToken);

  log.http(
    `completed fetching ${service.cloud}:${service.source} remote state information`
  );

  // check if empty
  if (resultArray.length === 0) {
    // nothing to add to database, so just return
    return Promise.resolve();
  }

  const cloud = resultArray[0].cloud;
  const source = resultArray[0].source;
  // get current database items
  const databaseItems = await dB.getDatabaseKeysForSource(cloud, source);

  const updateList = compareRemoteWithDatabase(resultArray, databaseItems);

  if (updateList.length === 0) {
    // no items to update
    return Promise.resolve();
  }

  let envVarArray: EnvVarArray = [];
  let nextToken;
  do {
    log.http(`requesting ${service.cloud}:${service.source} resources`);
    const envVarResult: GetEnvVarReturnValue = await service.getEnvVars(
      promiseQueue,
      updateList,
      nextToken
    );
    nextToken = envVarResult.nextToken;
    envVarArray = envVarArray.concat(envVarResult.envVarArray);
    envVarResult.envVarArray.forEach((envVar) => {
      log.http(`received ${service.cloud}:${service.source} ${envVar.key}`);
    });
  } while (nextToken);

  await dB.saveToDatabase(envVarArray);
};

// This strategy gets all remote items and update's the database
const putOneStrategy: UpdateRemoteStrategy = async (
  promiseQueue: PQueue,
  service: EnvVarService,
  overWriteValue: string,
  envVars: EnvVarArray
): Promise<UpdateRemoteStrategyReturnValue> => {
  if (!service.putEnvVar) {
    throw new Error(`putEnvVar is not defined for service ${service}`);
  }

  const putPromises: Array<Promise<PutEnvVarReturnValue>> = [];

  // eslint-disable-next-line guard-for-in
  for (const index in envVars) {
    log.http(
      `request update ${service.cloud}:${service.source} ${envVars[index].key}`
    );
    envVars[index].value = overWriteValue;
    putPromises.push(service.putEnvVar(promiseQueue, envVars[index]));
  }

  // resolve all put requests
  const result = await Promise.allSettled(putPromises);
  const returnResult: UpdateRemoteStrategyReturnValue = {
    success: [],
    failed: [],
  };
  result.forEach((promiseResult, index) => {
    const envVar = envVars[index];
    if (promiseResult?.status === 'fulfilled') {
      returnResult.success.push({
        envVar: envVar,
        raw: promiseResult?.value.raw,
      });
    } else {
      returnResult.failed.push({
        envVar: envVar,
        error: promiseResult?.reason,
      });
    }
  });

  return returnResult;
};

export class ServiceCaller {
  private getStrategies: UpdateDatabaseStrategy[];

  private putStrategies: UpdateRemoteStrategy[];

  public get writable() {
    return (
      this.service.writeCapability !== WriteCapabilityOfService.NOT_AVAILABLE
    );
  }

  public get cloud() {
    return this.service.cloud;
  }

  public get source() {
    return this.service.source;
  }

  constructor(
    private promiseQueue: PQueue,
    private dB: LocalDb,
    private service: EnvVarService
  ) {
    this.getStrategies = new Array<UpdateDatabaseStrategy>(2);
    this.putStrategies = new Array<UpdateRemoteStrategy>(1);
    this.getStrategies[
      ReadCapabilityOfService.GET_ALL_ONLY
    ] = getAllAndFillStrategy;
    this.getStrategies[
      ReadCapabilityOfService.CHECK_MODIFIED_AND_SPECIFIC
    ] = checkModifiedAndUpdateStrategy;
    this.putStrategies[WriteCapabilityOfService.WRITE_ONE] = putOneStrategy;
  }

  public async fetchAndUpdateDb() {
    await this.getStrategies[this.service.readCapability](
      this.promiseQueue,
      this.dB,
      this.service
    );
  }

  public async updateRemote(
    overWriteValue: string,
    envVarArray: EnvVarArray
  ): Promise<UpdateRemoteStrategyReturnValue> {
    if (
      this.service.writeCapability === WriteCapabilityOfService.NOT_AVAILABLE
    ) {
      return { success: [], failed: [] };
    }

    const envVarToUpdate = envVarArray.filter((envVar) => {
      const update =
        envVar.cloud === this.service.cloud &&
        envVar.source === this.service.source;
      return update;
    });

    const result = await this.putStrategies[this.service.writeCapability](
      this.promiseQueue,
      this.service,
      overWriteValue,
      envVarToUpdate
    );
    return result;
  }
}
