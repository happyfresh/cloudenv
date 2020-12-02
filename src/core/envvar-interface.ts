import PQueue from 'p-queue';
export { PQueue };

export interface GetEnvVarReturnValue {
  envVarArray: EnvVarArray;
  nextToken: any;
}

export interface PutEnvVarReturnValue {
  raw: any;
}

export interface EnvVar {
  key: string;
  value?: string;
  raw?: any;
  modifiedDate?: Date;
  cloud: string;
  source: string;
}

export type EnvVarArray = Array<EnvVar>;

export enum ReadCapabilityOfService {
  NOT_AVAILABLE = 0,
  GET_ALL_ONLY = 1,
  CHECK_MODIFIED_AND_SPECIFIC,
}

export enum WriteCapabilityOfService {
  NOT_AVAILABLE = 0,
  WRITE_MANY = 1,
  WRITE_ONE,
}

export interface EnvVarService {
  cloud: string;
  source: string;
  readCapability: ReadCapabilityOfService;
  writeCapability: WriteCapabilityOfService;
  getAllEnvVars?: (
    promiseQueue: PQueue,
    nextToken?: any
  ) => Promise<GetEnvVarReturnValue>;
  checkModifiedEnvVars?: (
    promiseQueue: PQueue,
    nextToken?: any
  ) => Promise<GetEnvVarReturnValue>;
  getEnvVars?: (
    promiseQueue: PQueue,
    list: string[],
    nextToken?: any
  ) => Promise<GetEnvVarReturnValue>;
  putEnvVar?: (
    promiseQueue: PQueue,
    envVar: EnvVar
  ) => Promise<PutEnvVarReturnValue>;
}
