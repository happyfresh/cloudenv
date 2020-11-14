import Command from '../base';
import { flags } from '@oclif/command';
import { CredentialManager } from '../core';
import { log } from '../util';
import { FinderService } from '../core';
import { OpsConfig } from 'ops-config';
import cli from 'cli-ux';
import { AWSParameterStore, AWSRoute53 } from '../aws-services';
import inquirer from 'inquirer';

export default class Key extends Command {
  static description =
    'find the environment variable value(s) given its key(s)';

  static strict = false;

  static flags = {
    ...Command.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),

    remote: flags.boolean({
      char: 'r',
      description: 'check remote state and download new values',
      allowNo: true,
    }),
  };

  static args = [
    {
      name: 'key',
      required: true,
      description: 'the environment variable key (glob pattern) to search for',
      hidden: false,
    },
    {
      name: 'additionalKeys',
      required: false,
      description:
        'additional environment variable key (glob patterns) to search for',
      hidden: false,
    },
  ];

  async run() {
    log.debug('starting program');
    const {
      args: { key, additionalKeys },
      flags,
    } = this.parse(Key);

    let allKeys: Array<string>;
    if (additionalKeys) {
      allKeys = [key].concat(additionalKeys);
    } else {
      allKeys = [key];
    }

    const cm = new CredentialManager();
    // await cm.getDefaultCredentials();
    const awsProfile = OpsConfig.get('aws.profile');
    const awsAccessKeyId = OpsConfig.get('aws.accessKeyId');
    const awsSecretAccessKey = OpsConfig.get('aws.secretAccessKey');
    let awsRegion = OpsConfig.get('aws.region');

    if (!awsRegion) {
      const questions = [
        {
          type: 'input',
          name: 'region',
          message:
            'aws region not detected in configuration / environment variables\nplease enter the aws region',
          default: false,
        },
      ];

      const { region } = await inquirer.prompt(questions);
      awsRegion = region;
    }

    if (awsProfile) {
      await cm.loginWithCredentialFile(awsProfile, awsRegion);
    } else {
      await cm.login(awsAccessKeyId, awsSecretAccessKey, awsRegion);
    }
    const finderService = new FinderService(this.getDb());
    finderService.addEnvVarSource(new AWSParameterStore());
    finderService.addEnvVarSource(new AWSRoute53());
    await finderService.runKeySearch(allKeys, OpsConfig.get('remote'));
  }
}
