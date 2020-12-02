import * as level from 'level';
import crypto from 'crypto';
import { log } from '../util';
import { EnvVar, EnvVarArray } from './envvar-interface';
import path from 'path';
import fs from 'fs';
import minimatch from 'minimatch';
import { cli } from 'cli-ux';
import os from 'os';
import BSON from 'bson-ext';
import moment from 'moment';
import { OpsConfig } from 'ops-config';

const customBar = (title: string) =>
  cli.progress({
    format: `${title} | {bar} | {value}/{total} Files`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });
interface MetaData {
  machineInfo: string;
  count: number;
  source: { [key: string]: { count: number; lastUpdated: Date } };
  lastUpdated: Date;
}

interface DBValue {
  value: string;
  raw?: { [key: string]: any };
  lastUpdated: Date;
}

// key format source|key|datetime
function dBKeyToEnvVarValue(key: string): EnvVar {
  const keyArray = key.split('|');
  const parameter: EnvVar = {
    cloud: keyArray[0],
    source: keyArray[1],
    key: keyArray[2],
  };
  return parameter;
}

function envVarValueToDbKey(parameter: EnvVar): string {
  return `${parameter.cloud}|${parameter.source}|${parameter.key}`;
}

function envVarValueToDbValue(parameter: EnvVar): DBValue {
  const modified = parameter?.modifiedDate
    ? parameter?.modifiedDate
    : moment().toDate();
  if (parameter?.value) {
    return {
      value: parameter.value,
      raw: parameter.raw,
      lastUpdated: modified,
    };
  }

  return { value: '', raw: undefined, lastUpdated: new Date() };
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

  public async close() {
    await this.db.close();
  }

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

  public async saveMetaDataToDatabase(metaData: MetaData) {
    await this.db.put('metadata', this.encryptJson(metaData));
  }

  public async getMetaDataFromDatabase(): Promise<MetaData> {
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
      lastUpdated: moment().year(1970).toDate(),
    });
  }

  public async openDatabase(filePath: string) {
    const instance = await new Promise((resolve, reject) => {
      level.default(
        filePath,
        { keyEncoding: 'binary', valueEncoding: 'binary' },
        function (err: Error, db: any) {
          if (err) reject(err);
          resolve(db);
        }
      );
    });

    this.db = instance;
  }

  public async getAllDatabaseKeys(): Promise<EnvVarArray> {
    const parameterArray: EnvVarArray = [];

    await new Promise((resolve, reject) => {
      this.db
        .createKeyStream()
        .on('data', function (key: any) {
          const keyString: string = key.toString() as string;
          if (keyString !== 'metadata') {
            parameterArray.push(dBKeyToEnvVarValue(keyString));
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

    return parameterArray;
  }

  public async updateMetaData(): Promise<MetaData> {
    const metaData = await this.getMetaDataFromDatabase();
    const dBCount = metaData.count ?? 0;
    let count = 0;
    const sources: MetaData['source'] = {};
    const bar = customBar('Updating cache metadata');
    bar.start(dBCount, 0);
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', (data: any) => {
          const keyString: string = data.key.toString() as string;
          const valueBuffer: Buffer = data.value;

          if (keyString !== 'metadata') {
            bar.update(++count);
            // update source metadata
            const parameter = dBKeyToEnvVarValue(keyString);

            const decryptedValue = this.decryptJson(valueBuffer) as DBValue;
            parameter.value = decryptedValue.value;
            parameter.raw = decryptedValue.raw;
            parameter.modifiedDate = decryptedValue.lastUpdated;
            const sourceName = `${parameter.cloud}:${parameter.source}`;

            if (sources[sourceName]) {
              sources[sourceName] = {
                count: sources[sourceName]?.count + 1,
                lastUpdated: moment
                  .max(
                    moment(decryptedValue.lastUpdated),
                    moment(sources[sourceName]?.lastUpdated)
                  )
                  .toDate() as Date,
              };
            } else {
              sources[sourceName] = {
                count: 1,
                lastUpdated: decryptedValue.lastUpdated as Date,
              };
            }
          }
        })
        .on('error', function (err: any) {
          log.error(err);
          reject(err);
        })
        .on('close', function () {
          bar.stop();
          resolve();
        });
    });

    metaData.count = count;
    metaData.source = sources;
    this.saveMetaDataToDatabase(metaData);
    return metaData;
  }

  public async getDatabaseKeysForSource(
    cloud: string,
    source: string
  ): Promise<EnvVarArray> {
    const parameterArray: EnvVarArray = [];

    await new Promise((resolve, reject) => {
      this.db
        .createKeyStream()
        .on('data', function (key: any) {
          const keyString: string = key.toString() as string;
          if (keyString === 'metadata') return;

          const envVar = dBKeyToEnvVarValue(keyString);
          if (envVar.cloud === cloud && envVar.source === source) {
            parameterArray.push(envVar);
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

    return parameterArray;
  }

  public async findKeyInDatabaseForValue(
    valuesToFind: Array<string>
  ): Promise<EnvVarArray> {
    const metaData = await this.getMetaDataFromDatabase();
    const dBCount = metaData.count ?? 0;

    const parameters: EnvVarArray = [];
    const bar = customBar('Searching for Key in Value');
    bar.start(dBCount, 0);
    let count = 0;
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', (data: any) => {
          const keyString: string = data.key.toString() as string;
          const valueBuffer: Buffer = data.value;

          if (keyString !== 'metadata') {
            bar.update(++count);
            // update source metadata
            const parameter = dBKeyToEnvVarValue(keyString);
            const decryptedValue = this.decryptJson(valueBuffer) as DBValue;

            const decryptedString = decryptedValue.value;
            const useGlob = OpsConfig.get('glob');
            const found = valuesToFind.some((value) => {
              return useGlob
                ? minimatch(decryptedString, value)
                : decryptedString.includes(value);
            });

            if (found) {
              parameter.value = decryptedString;
              parameter.raw = decryptedValue.raw;
              parameters.push(parameter);
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
    // update database metadata
    metaData.count = count;
    this.saveMetaDataToDatabase(metaData);

    return parameters;
  }

  public async findValueInDatabaseForKey(
    keysToFind: Array<string>
  ): Promise<EnvVarArray> {
    const metaData = await this.getMetaDataFromDatabase();
    const dBCount = metaData.count ?? 0;

    const parameters: EnvVarArray = [];
    const bar = customBar('Searching for Value in Key');
    bar.start(dBCount, 0);
    let count = 0;
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', (data: any) => {
          const keyStringRaw = data.key.toString() as string;
          const keyStringSplit = keyStringRaw.split('|');
          const keyString: string = keyStringSplit[keyStringSplit.length - 1];
          const valueBuffer: Buffer = data.value;

          if (keyStringRaw !== 'metadata') {
            bar.update(++count);
            // update source metadata
            const parameter = dBKeyToEnvVarValue(keyStringRaw);
            const useGlob = OpsConfig.get('glob');
            const found = keysToFind.some((key) => {
              return useGlob
                ? minimatch(keyString, key)
                : keyString.includes(key);
            });

            if (found) {
              const decryptedValue = this.decryptJson(valueBuffer) as DBValue;
              parameter.value = decryptedValue.value;
              parameter.raw = decryptedValue.raw;
              parameters.push(parameter);
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

    // update database metadata
    metaData.count = count;
    this.saveMetaDataToDatabase(metaData);

    return parameters;
  }

  public async saveToDatabase(parameters: EnvVarArray): Promise<boolean> {
    const dbOps: Array<{ type: string; key: string; value?: Buffer }> = [];
    if (
      parameters.length === 0 ||
      parameters === null ||
      parameters === undefined
    ) {
      return false;
    }

    const metaData = await this.getMetaDataFromDatabase();

    log.verbose(`encrypting ${parameters.length} values`);
    parameters.forEach((value) => {
      const key = envVarValueToDbKey(value as EnvVar);
      const parameterValue = envVarValueToDbValue(value as EnvVar);
      const encryptedValue = this.encryptJson(parameterValue);
      dbOps.push({ type: 'put', key, value: encryptedValue });
    });

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

    const now = new Date(moment().toDate());
    const envVarSample = parameters[0];
    const sourceName = `${envVarSample.cloud}:${envVarSample.source}`;
    if (!metaData.source[sourceName]) {
      metaData.source[sourceName] = {
        count: 0,
        lastUpdated: now,
      };
    }

    // update database metadata
    metaData.lastUpdated = now;
    this.saveMetaDataToDatabase(metaData);
    return true;
  }
}
