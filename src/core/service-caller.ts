/* eslint-disable no-await-in-loop */
import {
  EnvVarSource,
  CapabilityOfEnvVarSource,
  PQueue,
  EnvVarReturnValue,
  EnvVarDict,
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
  service: EnvVarSource
) => Promise<void>;

// This strategy gets all remote items and update's the database
const getAllAndFillStrategy: UpdateDatabaseStrategy = async (
  promiseQueue: PQueue,
  dB: LocalDb,
  service: EnvVarSource
): Promise<void> => {
  if (!service.getAllEnvVars) {
    throw new Error(`getAllEnvVars is not defined for service ${service}`);
  }
  const resultDict = {};
  let nextToken;
  do {
    const result: EnvVarReturnValue = await service.getAllEnvVars(
      promiseQueue,
      nextToken
    );
    nextToken = result.nextToken;
    Object.assign(resultDict, result.envVarDict);
  } while (nextToken);

  await dB.saveToDatabase(resultDict);
};

const compareRemoteWithDatabase = (
  remote: EnvVarDict,
  database: EnvVarDict
): Array<string> => {
  const getFinderList: Array<string> = [];
  Object.keys(remote).forEach((value) => {
    const databaseFinder = database[value];
    if (databaseFinder) {
      const isSame = moment(databaseFinder.modifiedDate).isSame(
        remote[value].modifiedDate
      );
      if (!isSame) {
        getFinderList.push(value);
      }
    } else {
      getFinderList.push(value);
    }
  });
  return getFinderList;
};

// This strategy check's the remote's last modified value
// and fetches and updates only items which were modified
const checkModifiedAndUpdateStrategy: UpdateDatabaseStrategy = async (
  promiseQueue: PQueue,
  dB: LocalDb,
  service: EnvVarSource
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
  const resultDict: EnvVarDict = {};
  let modifiedNextToken;
  do {
    const result: EnvVarReturnValue = await service.checkModifiedEnvVars(
      promiseQueue,
      modifiedNextToken
    );
    modifiedNextToken = result.nextToken;
    Object.assign(resultDict, result.envVarDict);
  } while (modifiedNextToken);

  const list = Object.keys(resultDict);
  // check if empty
  if (list.length === 0) {
    // nothing to add to database, so just return
    return Promise.resolve();
  }

  const cloud = resultDict[list[0]].cloud;
  const source = resultDict[list[0]].source;
  // get current database items
  const databaseItems = await dB.getDatabaseKeysForSource(cloud, source);

  const updateList = compareRemoteWithDatabase(resultDict, databaseItems);

  if (updateList.length === 0) {
    // no items to update
    return Promise.resolve();
  }

  const envVarDict = {};
  let nextToken;
  do {
    const envVarResult: EnvVarReturnValue = await service.getEnvVars(
      promiseQueue,
      updateList,
      nextToken
    );
    nextToken = envVarResult.nextToken;
    Object.assign(envVarDict, envVarResult.envVarDict);
  } while (nextToken);

  await dB.saveToDatabase(envVarDict);
};

export class ServiceCaller {
  private callingStrategies: UpdateDatabaseStrategy[];

  constructor(
    private promiseQueue: PQueue,
    private dB: LocalDb,
    private service: EnvVarSource
  ) {
    this.callingStrategies = new Array<UpdateDatabaseStrategy>(2);
    this.callingStrategies[
      CapabilityOfEnvVarSource.GET_ALL_ONLY
    ] = getAllAndFillStrategy;
    this.callingStrategies[
      CapabilityOfEnvVarSource.CHECK_MODIFIED_AND_SPECIFIC
    ] = checkModifiedAndUpdateStrategy;
  }

  public async fetchAndUpdateDb() {
    await this.callingStrategies[this.service.capabilityOfSource](
      this.promiseQueue,
      this.dB,
      this.service
    );
  }
}
