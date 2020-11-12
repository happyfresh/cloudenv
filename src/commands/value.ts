import Command from '../base';
import { flags } from '@oclif/command';
import { CredentialManager } from '../core';
import { log } from '../util';
import { FinderService } from '../core';
import { OpsConfig } from 'ops-config';
import cli from 'cli-ux';
import { AWSParameterStore, AWSRoute53 } from '../aws-services';

export default class Value extends Command {
  static description = 'find the environment variable key(s) given its value';

  static strict = false;

  static flags = {
    ...Command.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),

    remote: flags.boolean({
      char: 'r',
      description: 'check remote state and download new values',
      default: true,
      allowNo: true,
    }),
  };

  static args = [
    // ...Command.args,
    {
      name: 'value',
      required: true,
      description:
        'the environment variable value (glob pattern) to search for',
      hidden: false,
    },
    {
      name: 'additionalValues',
      required: false,
      description:
        'additional environment variable values (glob patterns) to search for',
      hidden: false,
    },
  ];

  async run() {
    log.debug('starting program');
    const {
      args: { value, additionalValues },
      flags,
    } = this.parse(Value);

    let allValues: Array<string>;
    if (additionalValues) {
      allValues = [value].concat(additionalValues);
    } else {
      allValues = [value];
    }

    const cm = new CredentialManager();
    // await cm.getDefaultCredentials();
    const awsProfile = OpsConfig.get('aws.profile');
    const awsAccessKeyId = OpsConfig.get('aws.accessKeyId');
    const awsSecretAccessKey = OpsConfig.get('aws.secretAccessKey');
    let awsRegion = OpsConfig.get('aws.region');

    if (!awsRegion) {
      awsRegion = await cli.prompt(
        'aws region not detected in configuration / environment variables\nplease enter the aws region'
      );
    }

    if (awsProfile) {
      await cm.loginWithCredentialFile(awsProfile, awsRegion);
    } else {
      await cm.login(awsAccessKeyId, awsSecretAccessKey, awsRegion);
    }
    const finderService = new FinderService(this.getDb());
    finderService.addEnvVarSource(new AWSParameterStore());
    finderService.addEnvVarSource(new AWSRoute53());
    await finderService.runSearch(allValues, flags.remote);
  }
}
