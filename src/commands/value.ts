import Command from '../base';
import { flags } from '@oclif/command';
import { CredentialManager } from '../core';
import { log } from '../util';
import { FinderService } from '../core';
import { OpsConfig } from 'ops-config';
import cli from 'cli-ux';
import { AWSParameterStore, AWSRoute53 } from '../aws-services';
import inquirer from 'inquirer';
import { schema } from '../schema';

export default class Value extends Command {
  static description = 'Find the environment variable key(s) given its value';

  static strict = false;

  static flags = {
    ...Command.flags,
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    remote: flags.boolean({
      char: 'r',
      description: 'Check remote state and download new values',
      allowNo: true,
    }),
    glob: flags.boolean({
      char: 'g',
      description: 'Use glob and regex patterns instead of simple matching',
      allowNo: true,
    }),
    writeValue: flags.string({
      char: 'w',
      description: 'Overwrite with new value',
    }),
  };

  static args = [
    {
      name: 'value',
      required: true,
      description:
        'The environment variable value (glob pattern) to search for',
      hidden: false,
    },
    {
      name: 'additionalValues',
      required: false,
      description:
        'Additional environment variable values (glob patterns) to search for',
      hidden: false,
    },
  ];

  async run() {
    log.debug('starting program');
    const {
      args: { value, additionalValues },
      flags,
    } = this.parse(Value);

    OpsConfig.clearArgs().clearEnvs();
    OpsConfig.init(schema, flags as any);

    if (flags?.dotenvFile) {
      OpsConfig.usePriorityPreset('cli').loadFromPathPriority(
        `cloudenv/${flags?.configFile}`,
        `cloudenv/${flags?.dotenvFile}`
      );
    } else {
      const configFile = `cloudenv/${flags?.configFile}`;
      OpsConfig.usePriorityPreset('cli').loadFromPathPriority(configFile);
    }

    let allValues: Array<string>;
    if (additionalValues) {
      allValues = [value].concat(additionalValues);
    } else {
      allValues = [value];
    }

    if (OpsConfig.get('remote')) {
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
    }
    const finderService = new FinderService(this.getDb());
    finderService.addEnvVarSource(new AWSParameterStore());
    finderService.addEnvVarSource(new AWSRoute53());
    const envVarArray = await finderService.runSearch(
      allValues,
      OpsConfig.get('remote')
    );

    if (flags?.writeValue) {
      log.noFormatting('\n');
      await finderService.runOverWrite(flags?.writeValue, envVarArray);
    }
  }
}
