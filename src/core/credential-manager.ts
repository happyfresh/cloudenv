import { LogManager } from '../util';
import * as AWS from 'aws-sdk';

const log = LogManager.Instance;

enum ConfigSource {
  NOT_INITIALIZED = 0,
  CUSTOM_VALUES,
  CREDENTIAL_FILE_DEFAULT,
  CREDENTIAL_FILE_PROFILE,
  ENVIRONMENT_VARIABLE,
  DEFAULT_CREDENTIAL_MECHANISM,
}

// load from custom
// load default profile file
// specify profile
// load from .env
export class CredentialManager {
  private static _instance: CredentialManager;

  private configSource: ConfigSource = ConfigSource.NOT_INITIALIZED;

  private static get Instance() {
    // eslint-disable-next-line no-return-assign
    return this._instance || (this._instance = new this());
  }

  public getConfigSource() {
    return CredentialManager.Instance.configSource;
  }

  public async loginWithEnvVars() {
    if (!process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('Environment variable AWS_ACCESS_KEY_ID must be set');
    }

    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('Environment variable AWS_ACCESS_KEY_ID must be set');
    }

    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
      throw new Error(
        'Environment variable AWS_REGION or AWS_DEFAULT_REGION must be set'
      );
    }
    // process.env.AWS_SDK_LOAD_CONFIG = 'false';
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region,
    });

    const obtainedKey = AWS.config.credentials?.accessKeyId;
    if (obtainedKey) {
      log.info(
        `Logged in with AWS environment variable, Region: ${region} Access key: ${obtainedKey}`
      );
    } else {
      throw new Error(`Failed to login() with Access key: ${obtainedKey}`);
    }
    this.configSource = ConfigSource.CUSTOM_VALUES;
    await this.getAccountAlias();
  }

  public async loginWithCredentialFile(
    profileName = 'default',
    region: string
  ) {
    // process.env.AWS_SDK_LOAD_CONFIG = 'true';
    const credentials = new AWS.SharedIniFileCredentials({
      profile: profileName,
    });

    AWS.config.credentials = credentials;
    AWS.config.update({ region });

    const obtainedKey = AWS.config.credentials?.accessKeyId;
    if (obtainedKey) {
      log.info(
        `Logged in with AWS credential file, Region: ${AWS.config?.region} Access key: ${obtainedKey}`
      );
    } else {
      throw new Error(
        `Failed to loginWithCredentialFile() with Profile Name: ${profileName}`
      );
    }
    if (profileName === 'default') {
      this.configSource = ConfigSource.CREDENTIAL_FILE_DEFAULT;
    } else {
      this.configSource = ConfigSource.CREDENTIAL_FILE_PROFILE;
    }
    await this.getAccountAlias();
  }

  public async login(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ) {
    // process.env.AWS_SDK_LOAD_CONFIG = 'false';
    AWS.config.update({ accessKeyId, secretAccessKey, region });

    const obtainedKey = AWS.config.credentials?.accessKeyId;
    if (obtainedKey) {
      log.info(
        `Logged in with AWS key pair, Region: ${region}, Access key: ${obtainedKey}`
      );
    } else {
      throw new Error(`Failed to login() with Access key: ${obtainedKey}`);
    }
    this.configSource = ConfigSource.CUSTOM_VALUES;
    await this.getAccountAlias();
  }

  public async getDefaultCredentials() {
    this.configSource = ConfigSource.DEFAULT_CREDENTIAL_MECHANISM;

    await new Promise<void | Error>((resolve, reject) => {
      AWS.config.getCredentials((err) => {
        if (err) {
          log.error(err.stack);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const obtainedKey = AWS.config.credentials?.accessKeyId;
    if (obtainedKey) {
      log.info(
        `Logged in with AWS default credential rules, Region: ${AWS.config?.region} Access key: ${obtainedKey}`
      );
    } else {
      throw new Error('Failed to getDefaultCredentials()');
    }

    await this.getAccountAlias();
  }

  public async getAccountAlias() {
    log.http('Requesting AWS account alias');
    const accountAliases = await new AWS.IAM().listAccountAliases({}).promise();
    log.info(
      `Logged into AWS account alias : ${accountAliases.AccountAliases}`
    );
  }
}
