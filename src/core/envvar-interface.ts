import PQueue from 'p-queue';
export { PQueue };

export interface EnvVarReturnValue {
  envVarDict: EnvVarDict;
  nextToken: any;
}

export interface EnvVar {
  key: string;
  value?: string;
  raw?: any;
  modifiedDate?: string;
  cloud: string;
  source: string;
}

export interface EnvVarDict {
  [key: string]: EnvVar;
}

export enum CapabilityOfEnvVarSource {
  GET_ALL_ONLY = 0,
  CHECK_MODIFIED_AND_SPECIFIC,
}

export interface EnvVarSource {
  cloud: string;
  source: string;
  capabilityOfSource: CapabilityOfEnvVarSource;
  getAllEnvVars?: (
    promiseQueue: PQueue,
    nextToken?: any
  ) => Promise<EnvVarReturnValue>;
  checkModifiedEnvVars?: (
    promiseQueue: PQueue,
    nextToken?: any
  ) => Promise<EnvVarReturnValue>;
  getEnvVars?: (
    promiseQueue: PQueue,
    list: string[],
    nextToken?: any
  ) => Promise<EnvVarReturnValue>;
}
