import { LogManager } from '../util';
import * as AWS from 'aws-sdk';

const log = LogManager.Instance;

export class CredentialManager {
  private getCredentials(): Promise<void | Error> {
    return new Promise<void | Error>((resolve, reject) => {
      AWS.config.getCredentials((err) => {
        if (err) {
          log.error(err.stack);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public async login() {
    try {
      log.verbose('getting credentials from local configuration');
      await this.getCredentials();
    } catch (error) {
      log.error(error);
    }
    process.env.AWS_SDK_LOAD_CONFIG = 'true';

    const accessKeyId = AWS.config.credentials?.accessKeyId;
    if (accessKeyId) {
      log.debug(`Access key: ${accessKeyId}`);
    }
  }
}
