import LevelUp from 'levelup';
import LevelDOWN from 'leveldown';
import crypto from 'crypto';
import { LogManager } from '../util';
import { EnvVar, EnvVarDict } from './envvar-interface';
import path from 'path';
import fs from 'fs';
import minimatch from 'minimatch';
import { cli } from 'cli-ux';
import os from 'os';

const log = LogManager.Instance;

// key format source|key|datetime
function dbKeyToFinderValue(key: string): EnvVar {
  const keyArray = key.split('|');
  const parameter: EnvVar = {
    cloud: keyArray[0],
    source: keyArray[1],
    key: keyArray[2],
    modifiedDate: keyArray[3],
  };
  return parameter;
}

function dbKeyToFinderKey(key: string): string {
  const keyArray = key.split('|');
  return keyArray[2];
}

function parameterValueToDbKey(parameter: EnvVar): string {
  return `${parameter.cloud}|${parameter.source}|${parameter.key}|${parameter.modifiedDate}`;
}

function parameterValueToDbValue(parameter: EnvVar): string {
  if (parameter?.value) {
    return parameter?.value;
  }
  return '';
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

  private password: string | undefined;

  private async saveMetaDataToDatabase(password: string, metaData: string) {
    const key = stretchString(password, 32);
    // const iv = stretchString('metadata', 16);
    const encryptedMessage = encrypt(key, Buffer.from(metaData));
    await this.db.put('metadata', encryptedMessage);
  }

  private async getMetaDataFromDatabase(password: string): Promise<string> {
    const key = stretchString(password, 32);
    // const iv = stretchString('metadata', 16);
    const encryptedMessage = (await this.db.get('metadata')) as Buffer;
    const clearText = decrypt(key, encryptedMessage);
    return clearText.toString();
  }

  public async checkDatabasePassword(password: string): Promise<boolean> {
    try {
      const metaData = await this.getMetaDataFromDatabase(password);
      if (metaData === 'PASSWORD_OK') {
        this.password = password;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  public async setDatabasePassword(password: string) {
    await this.saveMetaDataToDatabase(password, 'PASSWORD_OK');
  }

  public deleteDatabase(filePath: string) {
    if (process.env.NODE_ENV === 'development') {
      if (fs.existsSync(path.join(filePath, 'localdb'))) {
        fs.unlinkSync('./localdb');
      }
    } else {
      try {
        if (fs.existsSync(path.join(filePath, 'localdb'))) {
          fs.unlinkSync(path.join(filePath, 'localdb'));
        }
      } catch (error) {
        log.error(error);
      }
    }
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
            parameterDict[dbKeyToFinderKey(keyString)] = dbKeyToFinderValue(
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

          const envVar = dbKeyToFinderValue(keyString);
          if (envVar.cloud === cloud && envVar.source === source) {
            parameterDict[dbKeyToFinderKey(keyString)] = envVar;
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
    const parameters: EnvVarDict = {};
    const password = this.password as string;
    const cryptKey = stretchString(password, 32);
    // const cryptIv = stretchString('ivsalt', 16);
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', function (data: any) {
          const keyString: string = data.key.toString() as string;
          const valueString: Buffer = data.value;

          if (keyString !== 'metadata') {
            const decryptedValue = decrypt(cryptKey, valueString);

            const decryptedString = decryptedValue.toString();
            const found = valuesToFind.some((value) => {
              return minimatch(decryptedString, value);
            });

            if (found) {
              const parameter = dbKeyToFinderValue(keyString);
              parameter.value = decryptedValue.toString();
              parameters[dbKeyToFinderKey(keyString)] = parameter;
            }
          }
        })
        .on('error', function (err: any) {
          log.error('Oh my!', err);
          reject(err);
        })
        .on('close', function () {
          resolve();
        });
    });
    return parameters;
  }

  public async findValueInDatabaseForKey(
    keysToFind: Array<string>
  ): Promise<EnvVarDict> {
    const parameters: EnvVarDict = {};
    const password = this.password as string;
    const cryptKey = stretchString(password, 32);
    // const cryptIv = stretchString('ivsalt', 16);
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', function (data: any) {
          const keyString: string = data.key.toString() as string;
          const valueString: Buffer = data.value;
          if (keyString !== 'metadata') {
            const found = keysToFind.some((key) => {
              return minimatch(keyString, key);
            });

            if (found) {
              const decryptedValue = decrypt(cryptKey, valueString);
              const decryptedString = decryptedValue.toString();
              const parameter = dbKeyToFinderValue(keyString);
              parameter.value = decryptedString;
              parameters[dbKeyToFinderKey(keyString)] = parameter;
            }
          }
        })
        .on('error', function (err: any) {
          log.error('Oh my!', err);
          reject(err);
        })
        .on('close', function () {
          resolve();
        });
    });
    return parameters;
  }

  public async saveToDatabase(parameters: EnvVarDict): Promise<boolean> {
    const dbOps: Array<{ type: string; key: string; value?: Buffer }> = [];
    const cryptKey = stretchString(this.password as string, 32);
    // const cryptIv = stretchString('ivsalt', 16);
    Object.values(parameters).forEach((value, index, array) => {
      log.info(`processing ${index} of ${array.length}`);
      const key = parameterValueToDbKey(value as EnvVar);
      const parameterValue = parameterValueToDbValue(value as EnvVar);

      const encryptedValue = encrypt(cryptKey, Buffer.from(parameterValue));
      dbOps.push({ type: 'put', key, value: encryptedValue });
    });

    if (parameters === null || parameters === undefined || parameters === {}) {
      return false;
    }

    try {
      await new Promise((resolve, reject) => {
        this.db.batch(dbOps, function (err: Error) {
          if (err) {
            reject(err);
          }
          log.info('Successfully saved to database');
          resolve();
        });
      });
    } catch (error) {
      log.error('Error saving into database', error);
      return false;
    }

    return true;
  }
}
