/* eslint-disable no-await-in-loop */
import { LogManager } from '../util';
import * as AWS from 'aws-sdk';
import { RateLimiter, Interval } from 'limiter';
import { PromiseResult } from 'aws-sdk/lib/request';
import { ParameterDict } from '../core';
import cli from 'cli-ux';

function promiseTimeout(delayms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delayms);
  });
}

export interface NetworkResultItem {
  Name?: string | undefined;
  Type?: string | undefined;
  LastModifiedDate?: Date | undefined;
  DataType?: string | undefined;
  Value?: string | undefined;
}

export type NetworkResultArray = Array<NetworkResultItem>;

const log = LogManager.Instance;

function transformNetworkResultToParameter(
  networkResult: NetworkResultArray
): ParameterDict {
  const parameterDict: ParameterDict = {};
  networkResult.forEach((value) => {
    if (value?.Name && value.LastModifiedDate) {
      parameterDict[value.Name] = {
        key: value?.Name,
        modifiedDate: value.LastModifiedDate?.toISOString(),
        source: 'ssm',
        value: value.Value,
      };
    }
  });
  return parameterDict;
}

export class AWSSystemsManager {
  private _limiterConfig: [number, Interval, boolean];

  public constructor() {
    this._limiterConfig = [40, 'sec', false];
  }

  public async getAllEnvVars(): Promise<ParameterDict> {
    const envVars: NetworkResultArray = [];
    const rateLimiter = new RateLimiter(...this._limiterConfig);

    const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });

    cli.action.start('fetching remote state', 'initializing', { stdout: true });
    let NextToken;
    do {
      let result: PromiseResult<AWS.SSM.DescribeParametersResult, AWS.AWSError>;

      try {
        const params: AWS.SSM.DescribeParametersRequest = {
          MaxResults: 50,
          NextToken: NextToken,
        };
        result = await ssm.describeParameters(params).promise();
        NextToken = result.NextToken;
        const parameters = result.Parameters;
        if (parameters) {
          envVars.push(...parameters.values());
        } else {
          log.error('no parameters for result ', result);
        }
      } catch (error) {
        log.error(error);
        break;
      }
      if (rateLimiter.tryRemoveTokens(1)) {
        continue;
      } else {
        await promiseTimeout(1000);
      }
    } while (NextToken !== undefined);
    cli.action.stop('completed');

    const output = transformNetworkResultToParameter(envVars);
    return output;
  }

  public async getEnvVarValues(
    getList: Array<string>
  ): Promise<{
    parameters: ParameterDict | null;
    failedList: Array<string> | null;
  }> {
    const envVars: NetworkResultArray = [];
    const rateLimiter = new RateLimiter(...this._limiterConfig);
    const failedArray: Array<string> = [];

    const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });

    if (getList === undefined || getList === null || getList.length === 0) {
      return { parameters: null, failedList: null };
    }

    cli.action.start('inserting remote data into database', 'processing', {
      stdout: true,
    });
    while (getList.length > 0) {
      const getAmount = getList.length < 10 ? getList.length : 10;
      const spliceList = getList.splice(-getAmount, getAmount);

      const params = {
        Names: spliceList,
        WithDecryption: true,
      };
      // no retry if fail, just put in failed list
      try {
        const result = await ssm.getParameters(params).promise();
        const parameters = result.Parameters;
        if (parameters) {
          envVars.push(...parameters.values());
        } else {
          log.error('no parameters for result ', result);
          failedArray.push(...spliceList);
        }
      } catch (error) {
        failedArray.push(...spliceList);
        log.error(error);
      }

      if (rateLimiter.tryRemoveTokens(1)) {
        continue;
      } else {
        await promiseTimeout(1000);
      }
    }
    cli.action.stop('completed');

    const output = transformNetworkResultToParameter(envVars);
    return { parameters: output, failedList: failedArray };
  }
}
