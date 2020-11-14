/* eslint-disable no-await-in-loop */
import AWS from 'aws-sdk';
import {
  CapabilityOfEnvVarSource,
  EnvVarDict,
  EnvVarReturnValue,
  EnvVarSource,
  EnvVar,
  PQueue,
} from '../core/envvar-interface';

enum SourceInfo {
  cloud = 'AWS',
  source = 'SSM:ParameterStore',
}

function createTestType(func: Function) {
  if (func === Number || func === String || func === Boolean) {
    // Primitive type
    const expected = func.name.toLowerCase();

    return (item: any) => typeof item === expected;
  }

  return (item: any) => item instanceof func;
}

function isPureArrayOf<T>(array: any[], func: new () => T): array is T[] {
  const testType = createTestType(func);
  for (const item of array) {
    if (!testType(item)) {
      return false;
    }
  }

  return true;
}

interface NetworkResultItem {
  Name?: string;
  Type?: string;
  LastModifiedDate?: Date;
  DataType?: string;
  Value?: string;
}

function transformNetworkResultToEnvVar(
  key: string,
  networkResult: NetworkResultItem
): EnvVar {
  return {
    key: key,
    modifiedDate: networkResult.LastModifiedDate?.toISOString(),
    source: SourceInfo.source,
    cloud: SourceInfo.cloud,
    value: networkResult.Value,
  };
}

export class AWSParameterStore implements EnvVarSource {
  public get cloud() {
    return SourceInfo.cloud;
  }

  public get source() {
    return SourceInfo.source;
  }

  public capabilityOfSource: CapabilityOfEnvVarSource =
    CapabilityOfEnvVarSource.CHECK_MODIFIED_AND_SPECIFIC;

  private service = new AWS.SSM({ apiVersion: '2014-11-06', maxRetries: 2 });

  public async checkModifiedEnvVars(
    promiseQueue: PQueue,
    nextToken?: any
  ): Promise<EnvVarReturnValue> {
    if (nextToken && !(typeof nextToken === 'string')) {
      throw new Error('nextToken must be typeof string');
    }

    const params: AWS.SSM.DescribeParametersRequest = {
      MaxResults: 50,
      NextToken: nextToken,
    };

    const result = await promiseQueue.add(() =>
      this.service.describeParameters(params).promise()
    );
    const token = result?.NextToken;
    const parameters = result?.Parameters;

    const envVar: EnvVarDict = {};
    if (!parameters) {
      return { nextToken: undefined, envVarDict: {} };
    }

    parameters.forEach((value) => {
      const key = value?.Name as string;
      envVar[key] = transformNetworkResultToEnvVar(key, value);
    });

    return { nextToken: token, envVarDict: envVar };
  }

  public async getEnvVars(
    promiseQueue: PQueue,
    list: string[],
    nextToken?: any
  ): Promise<EnvVarReturnValue> {
    if (list === undefined || list === null || list.length === 0) {
      throw new Error('list must be longer than 0');
    }

    if (nextToken && !isPureArrayOf(nextToken, String)) {
      throw new Error('nextToken must be Array<string>');
    }

    const getList = nextToken ?? list;
    const getAmount = getList.length < 10 ? getList.length : 10;
    const currentList = getList.slice(-getAmount);
    let nextList;
    if (getList.length > 10) {
      nextList = getList.slice(0, getList.length - getAmount);
    }

    const params: AWS.SSM.GetParametersRequest = {
      Names: currentList,
      WithDecryption: true,
    };

    const result = await promiseQueue.add(() =>
      this.service.getParameters(params).promise()
    );

    const parameters = result?.Parameters as AWS.SSM.ParameterList;

    const envVar: EnvVarDict = {};
    if (!parameters) {
      return { nextToken: undefined, envVarDict: {} };
    }

    parameters.forEach((value) => {
      const key = value?.Name as string;
      envVar[key] = transformNetworkResultToEnvVar(key, value);
    });

    return { nextToken: nextList, envVarDict: envVar };
  }
}
