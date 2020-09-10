import LevelUp from 'levelup';
import LevelDOWN from 'leveldown';
import crypto from 'crypto';
import { LogManager } from '../util';
import { Parameter, ParameterDict, ParameterDatabaseSyncEnum } from '.';
import path from 'path';
import fs from 'fs';
import minimatch from 'minimatch';
import { cli } from 'cli-ux';

const log = LogManager.Instance;

// key format source|key|datetime
function dbKeyToParameterValue(
  key: string,
  syncStatus: ParameterDatabaseSyncEnum = 0
): Parameter {
  const keyArray = key.split('|');
  const parameter: Parameter = {
    source: keyArray[0],
    key: keyArray[1],
    modifiedDate: keyArray[2],
    syncStatus,
  };
  return parameter;
}

function dbKeyToParameterKey(key: string): string {
  const keyArray = key.split('|');
  return keyArray[1];
}

function parameterValueToDbKey(parameter: Parameter): string {
  return `${parameter.source}|${parameter.key}|${parameter.modifiedDate}`;
}

function parameterValueToDbValue(parameter: Parameter): string {
  if (parameter?.value) {
    return parameter?.value;
  }
  return '';
}

interface Key {
  cipherKey: Buffer;
  hashingSalt: Buffer;
}

function stretchString(s: string, outputLength: number) {
  const salt = 'abcdefghijklmnop'; // crypto.randomBytes(16);
  const keyBuf = crypto.pbkdf2Sync(s, salt, 100000, outputLength, 'sha512');
  return keyBuf;
}

function encrypt(iv: Buffer, key: Buffer, sourceData: Buffer) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(sourceData);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted;
}

function decrypt(iv: Buffer, key: Buffer, encryptedData: Buffer) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted;
}

export class LocalDb {
  private db: any;

  private password: string | undefined;

  private async saveMetaDataToDatabase(password: string, metaData: string) {
    const key = stretchString(password, 32);
    const iv = stretchString('metadata', 16);
    const encryptedMessage = encrypt(iv, key, Buffer.from(metaData));
    await this.db.put('metadata', encryptedMessage);
  }

  private async getMetaDataFromDatabase(password: string): Promise<string> {
    const key = stretchString(password, 32);
    const iv = stretchString('metadata', 16);
    const encryptedMessage = (await this.db.get('metadata')) as Buffer;
    const clearText = decrypt(iv, key, encryptedMessage);
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
    if (process.env.NODE_ENV === 'development') {
      this.db = new LevelUp(new LevelDOWN('./localdb'));
    } else {
      fs.mkdirSync(filePath, { recursive: true });
      this.db = new LevelUp(new LevelDOWN(path.join(filePath, 'localdb')));
    }
  }

  public async getAllDatabaseItems(): Promise<ParameterDict> {
    const parameterDict: ParameterDict = {};

    await new Promise((resolve, reject) => {
      this.db
        .createKeyStream()
        .on('data', function (key: any) {
          const keyString: string = key.toString() as string;
          if (keyString !== 'metadata') {
            parameterDict[
              dbKeyToParameterKey(keyString)
            ] = dbKeyToParameterValue(keyString);
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
    valuesToFind: Array<string>,
    numberOfItems: number
  ): Promise<ParameterDict> {
    const parameters: ParameterDict = {};
    const password = this.password as string;
    const cryptKey = stretchString(password, 32);
    const cryptIv = stretchString('ivsalt', 16);
    let count = 0;
    const customBar = cli.progress({
      format: 'PROGRESS | {bar} | {value}/{total} Files',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    customBar.start(numberOfItems, 0);
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', function (data: any) {
          ++count;
          customBar.update(count);
          const keyString: string = data.key.toString() as string;
          const valueString: Buffer = data.value;

          if (keyString !== 'metadata') {
            const decryptedValue = decrypt(cryptIv, cryptKey, valueString);

            const decryptedString = decryptedValue.toString();
            const found = valuesToFind.some((value) => {
              return minimatch(decryptedString, value);
            });

            if (found) {
              const parameter = dbKeyToParameterValue(keyString);
              parameter.value = decryptedValue.toString();
              parameters[dbKeyToParameterKey(keyString)] = parameter;
            }
          }
        })
        .on('error', function (err: any) {
          log.error('Oh my!', err);
          reject(err);
        })
        .on('close', function () {
          customBar.stop();
          resolve();
        });
    });
    return parameters;
  }

  public async findValueInDatabaseForKey(
    keysToFind: Array<string>,
    numberOfItems: number
  ): Promise<ParameterDict> {
    const parameters: ParameterDict = {};
    const password = this.password as string;
    const cryptKey = stretchString(password, 32);
    const cryptIv = stretchString('ivsalt', 16);
    let count = 0;
    const customBar = cli.progress({
      format: 'PROGRESS | {bar} | {value}/{total} Files',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    customBar.start(numberOfItems, 0);
    await new Promise((resolve, reject) => {
      this.db
        .createReadStream()
        .on('data', function (data: any) {
          ++count;
          customBar.update(count);
          const keyString: string = data.key.toString() as string;
          const valueString: Buffer = data.value;
          if (keyString !== 'metadata') {
            const found = keysToFind.some((key) => {
              return minimatch(keyString, key);
            });

            if (found) {
              const decryptedValue = decrypt(cryptIv, cryptKey, valueString);
              const decryptedString = decryptedValue.toString();
              const parameter = dbKeyToParameterValue(keyString);
              parameter.value = decryptedString;
              parameters[dbKeyToParameterKey(keyString)] = parameter;
            }
          }
        })
        .on('error', function (err: any) {
          log.error('Oh my!', err);
          reject(err);
        })
        .on('close', function () {
          customBar.stop();
          resolve();
        });
    });
    return parameters;
  }

  public async saveToDatabase(
    parameters: ParameterDict,
    source: string
  ): Promise<boolean> {
    const dbOps: Array<{ type: string; key: string; value?: Buffer }> = [];
    const cryptKey = stretchString(this.password as string, 32);
    const cryptIv = stretchString('ivsalt', 16);
    Object.values(parameters).forEach((value, index, array) => {
      log.info(`processing ${index} of ${array.length}`);
      value.source = source;
      const key = parameterValueToDbKey(value as Parameter);
      const parameterValue = parameterValueToDbValue(value as Parameter);

      const encryptedValue = encrypt(
        cryptIv,
        cryptKey,
        Buffer.from(parameterValue)
      );
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

  // public async addToDB() {}

  public async test() {
    // 2) Put a key & value
    try {
      await this.db.put('ssm|ALOHA_WINNER|2020-02-10T04:09:22.140Z', 'levelup');

      const value = await this.db.get(
        'ssm|ALOHA_WINNER|2020-02-10T04:09:22.140Z'
      );

      // Ta da!
      log.info('value=' + value);
    } catch (error) {
      if (error) return log.error(error); // likely the key was not found
    }
  }
}
