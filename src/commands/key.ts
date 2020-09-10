import { flags } from '@oclif/command';
import { CredentialManager } from '../core';
import { LogManager } from '../util';
import { ParameterService } from '../core';
import Command from '../base';

const log = LogManager.Instance;

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
      default: true,
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
    await cm.login();
    const parameterService = new ParameterService(this.getDb());
    await parameterService.runKeySearch(allKeys, flags.remote);
  }
}
