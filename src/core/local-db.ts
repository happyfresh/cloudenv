import LevelUp from 'levelup';
import LevelDOWN from 'leveldown';
import crypto from 'crypto';
import { log } from '../util';
import { EnvVar, EnvVarDict } from './envvar-interface';
import path from 'path';
import fs from 'fs';
import minimatch from 'minimatch';
import { cli } from 'cli-ux';
import os from 'os';
import BSON from 'bson-ext';
import moment from 'moment';

const customBar = (title: string) =>
  cli.progress({
    format: `${title} | {bar} | {value}/{total} Files`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
interface MetaData {
  machineInfo: string;
  count: number;
  source: { [key: string]: { count?: number; lastUpdated?: Date } };
  lastUpdated: Date;
}

interface DBValue {
  value: string;
  raw?: { [key: string]: any };
}

// key format source|key|datetime
function dBKeyToEnvVarValue(key: string): EnvVar {
  const keyArray = key.split('|');
  const parameter: EnvVar = {
    cloud: keyArray[0],
    source: keyArray[1],
    key: keyArray[2],
    modifiedDate: keyArray[3],
  };
  return parameter;
}

function dBKeyToEnvVarKey(key: string): string {
  const keyArray = key.split('|');
  return keyArray[2];
}

function envVarValueToDbKey(parameter: EnvVar): string {
  return `${parameter.cloud}|${parameter.source}|${parameter.key}|${parameter.modifiedDate}`;
}

function envVarValueToDbValue(parameter: EnvVar): DBValue {
  if (parameter?.value) {
    return { value: parameter.value, raw: parameter.raw };
  }
  return { value: '', raw: undefined };
}

function stretchString(s: string, outputLength: number) {
  const salt = `${os.userInfo().username}:${os.hostname()}`;
  const keyBuf = crypto.pbkdf2Sync(s, salt, 100000, outputLength, 'sha512');
  return keyBuf;
}

function encrypt(key: Buffer, sourceData: Buffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(sourceData);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const appendedBuffer = Buffer.concat([iv, encrypted]);
  return appendedBuffer;
}

function decrypt(key: Buffer, encryptedData: Buffer) {
  const iv = encryptedData.subarray(0, 16);
  const data = encryptedData.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted;
}

export class LocalDb {
  private db: any;

  private key: Buffer | undefined;

  private bson = new BSON([
    BSON.Binary,
    BSON.Code,
    BSON.DBRef,
    BSON.Decimal128,
    BSON.Double,
    BSON.Int32,
    BSON.Long,
    BSON.Map,
    BSON.MaxKey,
    BSON.MinKey,
    BSON.ObjectId,
    BSON.BSONRegExp,
    BSON.Symbol,
    BSON.Timestamp,
  ]);

  private encryptJson(object: { [key: string]: any }): Buffer {
    const encryptedMessage = encrypt(
      this.key as Buffer,
      this.bson.serialize(object)
    );
    return encryptedMessage;
  }

  private decryptJson(object: Buffer): { [key: string]: any } {
    const clearText = decrypt(this.key as Buffer, object);
    const decryptedMessage = this.bson.deserialize(clearText);
    return decryptedMessage;
  }

  private async saveMetaDataToDatabase(metaData: MetaData) {
    await this.db.put('metadata', this.encryptJson(metaData));
  }

  private async getMetaDataFromDatabase(): Promise<MetaData> {
    const encryptedMessage = (await this.db.get('metadata')) as Buffer;
    return this.decryptJson(encryptedMessage) as MetaData;
  }

  public async unlockDatabase(password: string): Promise<boolean> {
    this.key = stretchString(password, 32);
    try {
      const metaData = await this.getMetaDataFromDatabase();
      if (
        metaData.machineInfo === `${os.userInfo().username}:${os.hostname()}`
      ) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  public async setNewDatabasePassword(password: string) {
    this.key = stretchString(password, 32);
    await this.saveMetaDataToDatabase({
      machineInfo: `${os.userInfo().username}:${os.hostname()}`,
      count: 0,
      source: {},
      lastUpdated: moment().toDate(),
    });
  }

  public openDatabase(filePath: string) {
    this.db = new LevelUp(new LevelDOWN(filePath));
  }

  public async getAllDatabaseKeys(): Promise<EnvVarDict> {
    const parameterDict: EnvVarDict = {};

    await new Promise((resolve, reject) => {
      this.db
        .createKeyStream()
        .on('data', function (key: any) {
          const keyString: string = key.toString() as string;
          if (keyString !== 'metadata') {
            parameterDict[dBKeyToEnvVarKey(keyString)] = dBKeyToEnvVarValue(
              keyString
            );
          }
        })
        .on('error', function (err: any) {
          log.error(err);
          reject(err);
        })
        .on('close', function () {
          resolve();
        });
    });

    return parameterDict;
  }

  public async getDatabaseKeysForSource(
    cloud: string,
    source: string
  ): Promise<EnvVarDict> {
    const parameterDict: EnvVarDict = {};

    await new Promise((resolve, reject) => {
      this.db
        .createKeyStream()
        .on('data', function (key: any) {
          const keyString: string = key.toString() as string;
          if (keyString === 'metadata') return;

          const envVar = dBKeyToEnvVarValue(keyString);
          if (envVar.cloud === cloud && envVar.source === source) {
            parameterDict[dBKeyToEnvVarKey(keyString)] = envVar;
          }
        })
        .on('error', function (err: any) {
          log.error(err);
          reject(err);
        })
        .on('close', function () {
          resolve();
        });
    });

    return parameterDict;
  }

  public async findKeyInDatabaseForValue(
    valuesToFind: Array<string>
  ): Promise<EnvVarDict> {
    const metaData = await this.getMetaDataFromDatabase();
    const dBCount = metaData.count ?? 0;

    const parameters: EnvVarDict = {};
    const bar = customBar('Searching for Key in Value');
    bar.start(dBCount, 0);
    let count = 1;
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', (data: any) => {
          const keyString: string = data.key.toString() as string;
          const valueBuffer: Buffer = data.value;

          if (keyString !== 'metadata') {
            bar.update(count++);
            const decryptedValue = this.decryptJson(valueBuffer) as DBValue;

            const decryptedString = decryptedValue.value;
            const found = valuesToFind.some((value) => {
              return minimatch(decryptedString, value);
            });

            if (found) {
              const parameter = dBKeyToEnvVarValue(keyString);
              parameter.value = decryptedString;
              parameter.raw = decryptedValue.raw;
              parameters[dBKeyToEnvVarKey(keyString)] = parameter;
            }
          }
        })
        .on('error', function (err: any) {
          log.error('Oh my!', err);
          reject(err);
        })
        .on('close', function () {
          bar.stop();
          resolve();
        });
    });
    return parameters;
  }

  public async findValueInDatabaseForKey(
    keysToFind: Array<string>
  ): Promise<EnvVarDict> {
    const metaData = await this.getMetaDataFromDatabase();
    const dBCount = metaData.count ?? 0;

    const parameters: EnvVarDict = {};
    const bar = customBar('Searching for Value in Key');
    bar.start(dBCount, 0);
    let count = 1;
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', (data: any) => {
          const keyString: string = data.key.toString() as string;
          const valueBuffer: Buffer = data.value;

          if (keyString !== 'metadata') {
            bar.update(count++);
            const found = keysToFind.some((key) => {
              return minimatch(keyString, key);
            });

            if (found) {
              const decryptedValue = this.decryptJson(valueBuffer) as DBValue;
              const parameter = dBKeyToEnvVarValue(keyString);
              parameter.value = decryptedValue.value;
              parameter.raw = decryptedValue.raw;
              parameters[dBKeyToEnvVarKey(keyString)] = parameter;
            }
          }
        })
        .on('error', function (err: any) {
          log.error('Oh my!', err);
          reject(err);
        })
        .on('close', function () {
          bar.stop();
          resolve();
        });
    });
    return parameters;
  }

  public async saveToDatabase(parameters: EnvVarDict): Promise<boolean> {
    const dbOps: Array<{ type: string; key: string; value?: Buffer }> = [];
    if (Object.keys(parameters).length === 0) {
      return false;
    }

    const metaData = await this.getMetaDataFromDatabase();
    const dBCount = metaData.count ?? 0;
    let count = 0;

    const values = Object.values(parameters);
    log.verbose(`encrypting ${values.length} values`);
    values.forEach((value, index, array) => {
      const key = envVarValueToDbKey(value as EnvVar);
      const parameterValue = envVarValueToDbValue(value as EnvVar);
      const encryptedValue = this.encryptJson(parameterValue);
      dbOps.push({ type: 'put', key, value: encryptedValue });
      count++;
    });

    if (parameters === null || parameters === undefined || parameters === {}) {
      return false;
    }

    log.verbose('inserting new values into cache');
    try {
      await new Promise((resolve, reject) => {
        this.db.batch(dbOps, function (err: Error) {
          if (err) {
            reject(err);
          }
          log.verbose('Successfully saved to database');
          resolve();
        });
      });
    } catch (error) {
      log.error('Error saving into database', error);
      return false;
    }

    // update source metadata
    const now = new Date(moment().toDate());
    const envVarSample = Object.values(parameters)[0];
    const sourceName = `${envVarSample.cloud}:${envVarSample.source}`;
    const sourceCount = metaData?.source[sourceName]?.count ?? 0;
    metaData.source[sourceName] = {
      count: sourceCount + count,
      lastUpdated: now,
    };

    // update database metadata
    metaData.count = dBCount + count;
    metaData.lastUpdated = now;
    this.saveMetaDataToDatabase(metaData);
    return true;
  }
}
