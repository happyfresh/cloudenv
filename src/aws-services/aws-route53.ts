/* eslint-disable no-await-in-loop */
import AWS from 'aws-sdk';
import moment from 'moment';
import {
  ReadCapabilityOfService,
  EnvVarArray,
  GetEnvVarReturnValue,
  EnvVarService,
  EnvVar,
  PQueue,
  WriteCapabilityOfService,
} from '../core/envvar-interface';

enum SourceInfo {
  cloud = 'AWS',
  source = 'Route53:HostedZone',
}

interface RecordSetTruncInfo {
  hostedZoneId: string;
  recordSetMarker?: {
    StartRecordIdentifier: string;
    StartRecordName: string;
    StartRecordType:
      | 'SOA'
      | 'A'
      | 'TXT'
      | 'NS'
      | 'CNAME'
      | 'MX'
      | 'NAPTR'
      | 'PTR'
      | 'SRV'
      | 'SPF'
      | 'AAAA'
      | 'CAA';
  };
}

interface NextToken {
  hostedZoneAccumulator?: Array<string>;
  hostedZoneMarker?: string;
  recordSetNextInfo?: Array<RecordSetTruncInfo>;
}

interface NetworkResultItem {
  Name?: string;
  Type?: string;
  SetIdentifier?: string;
  ResourceRecords?: Array<{ Value: string }>;
  AliasTarget?: {
    DNSName: string;
    EvaluateTargetHealth: boolean;
    HostedZoneId: string;
  };
}

function transformNetworkResultToEnvVar(
  key: string,
  networkResult: NetworkResultItem
): EnvVar {
  const valueArray = networkResult.ResourceRecords?.map(
    (records) => records.Value
  );
  if (networkResult.AliasTarget) {
    valueArray?.push(networkResult.AliasTarget.DNSName);
  }
  return {
    key: key,
    value: valueArray?.toString(),
    raw: networkResult,
    modifiedDate: moment().toDate(),
    cloud: SourceInfo.cloud,
    source: SourceInfo.source,
  };
}

export class AWSRoute53 implements EnvVarService {
  public get cloud() {
    return SourceInfo.cloud;
  }

  public get source() {
    return SourceInfo.source;
  }

  public get readCapability(): ReadCapabilityOfService {
    return ReadCapabilityOfService.GET_ALL_ONLY;
  }

  public get writeCapability(): WriteCapabilityOfService {
    return WriteCapabilityOfService.NOT_AVAILABLE;
  }

  private service = new AWS.Route53({
    apiVersion: '2013-04-01',
    maxRetries: 2,
  });

  public async getAllEnvVars(
    promiseQueue: PQueue,
    nextToken?: NextToken
  ): Promise<GetEnvVarReturnValue> {
    // get a list of all hosted zones
    let hostedZoneIds: Array<string> = [];
    if (!nextToken?.recordSetNextInfo) {
      let dataHostedZones;
      if (nextToken?.hostedZoneMarker) {
        dataHostedZones = await promiseQueue.add(() =>
          this.service
            .listHostedZones({
              Marker: nextToken?.hostedZoneMarker,
            })
            .promise()
        );
      } else {
        dataHostedZones = await promiseQueue.add(() =>
          this.service.listHostedZones().promise()
        );
      }

      hostedZoneIds = dataHostedZones.HostedZones.map((value: any) => value.Id);
      // handle for truncated response in nextToken
      if (nextToken?.hostedZoneAccumulator) {
        hostedZoneIds = hostedZoneIds.concat(nextToken?.hostedZoneAccumulator);
      }

      // return empty array and next token
      if (dataHostedZones.IsTruncated) {
        const returnValue: {
          nextToken: NextToken;
          envVarArray: EnvVarArray;
        } = {
          nextToken: {
            hostedZoneAccumulator: hostedZoneIds,
            hostedZoneMarker: dataHostedZones.NextMarker,
          },
          envVarArray: [],
        };

        return returnValue;
      }
    }

    // get a list of all resource record sets
    const resultPromises: Array<any> = [];
    if (nextToken?.recordSetNextInfo) {
      nextToken?.recordSetNextInfo.forEach((recordSetInfo) => {
        resultPromises.push(() =>
          this.service
            .listResourceRecordSets({
              HostedZoneId: recordSetInfo.hostedZoneId,
              ...recordSetInfo.recordSetMarker,
            })
            .promise()
        );
      });
    } else {
      hostedZoneIds.forEach((hostedZoneId: any) => {
        resultPromises.push(() =>
          this.service
            .listResourceRecordSets({
              HostedZoneId: hostedZoneId,
            })
            .promise()
        );
      });
    }

    const result: any = await promiseQueue.addAll(resultPromises);
    const truncatedList: Array<RecordSetTruncInfo> = [];

    let hostedZoneReference: Array<string>;
    if (hostedZoneIds.length > 0) {
      hostedZoneReference = hostedZoneIds;
    } else {
      hostedZoneReference = (nextToken?.recordSetNextInfo as Array<RecordSetTruncInfo>).map(
        (recordset) => recordset.hostedZoneId
      );
    }

    const envVarArray: EnvVarArray = result.reduce(
      (acc: EnvVarArray, response: any, index: number) => {
        if (response.IsTruncated) {
          // for now cannot handle truncated
          const truncatedParameters = {
            hostedZoneId: hostedZoneReference[index],
            recordSetMarker: {
              StartRecordIdentifier: response.NextRecordIdentifier,
              StartRecordName: response.NextRecordName,
              StartRecordType: response.NextRecordType,
            },
          };
          truncatedList.push(truncatedParameters);
        }

        const recordSetArray = response.ResourceRecordSets;
        recordSetArray.forEach((recordSet: NetworkResultItem) => {
          const key = `${hostedZoneReference[index]}/${recordSet.Name}/${
            recordSet.Type
          }${recordSet.SetIdentifier ? '/' + recordSet.SetIdentifier : ''}`;
          acc.push(transformNetworkResultToEnvVar(key, recordSet));
        });
        return acc;
      },
      []
    );

    // return empty array and next token
    if (truncatedList.length > 0) {
      const returnValue: {
        nextToken: NextToken;
        envVarArray: EnvVarArray;
      } = {
        nextToken: {
          recordSetNextInfo: truncatedList,
        },
        envVarArray: envVarArray,
      };

      return returnValue;
    }

    return { nextToken: undefined, envVarArray };
  }
}
