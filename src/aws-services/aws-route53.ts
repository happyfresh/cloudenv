/* eslint-disable no-await-in-loop */
import AWS from 'aws-sdk';
import moment from 'moment';
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
  source = 'Route53:HostedZone',
}

interface NetworkResultItem {
  Name?: string;
  ResourceRecords?: Array<{ Value: string }>;
}

function transformNetworkResultToEnvVar(
  key: string,
  networkResult: NetworkResultItem
): EnvVar {
  return {
    key: key,
    value: networkResult.Name,
    raw: networkResult,
    modifiedDate: moment().toISOString(),
    cloud: SourceInfo.cloud,
    source: SourceInfo.source,
  };
}

export class AWSRoute53 implements EnvVarSource {
  public get cloud() {
    return SourceInfo.cloud;
  }

  public get source() {
    return SourceInfo.source;
  }

  public capabilityOfSource: CapabilityOfEnvVarSource =
    CapabilityOfEnvVarSource.GET_ALL_ONLY;

  private service = new AWS.Route53({
    apiVersion: '2013-04-01',
    maxRetries: 2,
  });

  public async getAllEnvVars(
    promiseQueue: PQueue,
    nextToken?: any
  ): Promise<EnvVarReturnValue> {
    // get a list of all hosted zones
    const dataHostedZones = await promiseQueue.add(() =>
      this.service.listHostedZones().promise()
    );
    const hostedZoneIds = dataHostedZones.HostedZones.map(
      (value: any) => value.Id
    );
    const resultPromises: Array<any> = [];
    hostedZoneIds.forEach((hostedZoneId: any) => {
      resultPromises.push(() =>
        this.service
          .listResourceRecordSets({
            HostedZoneId: hostedZoneId,
          })
          .promise()
      );
    });

    const result: any = await promiseQueue.addAll(resultPromises);
    const envVarDict: EnvVarDict = result.reduce(
      (acc: any, response: any, index: number) => {
        if (response.IsTruncated) {
          // for now cannot handle truncated
          throw new Error('Hosted Zone ResourceRecordSet is Truncated');
        }
        const recordSetArray = response.ResourceRecordSets;
        let count = 0;
        recordSetArray.forEach((recordSet: NetworkResultItem) => {
          const key = `${hostedZoneIds[index]}[${count++}]`;
          acc[key] = transformNetworkResultToEnvVar(key, recordSet);
        });
        return acc;
      },
      {} as EnvVarDict
    );
    return { nextToken: undefined, envVarDict };
  }
}
