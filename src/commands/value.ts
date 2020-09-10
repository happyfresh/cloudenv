import { flags } from '@oclif/command';
import { CredentialManager } from '../core';
import { LogManager } from '../util';
import { ParameterService } from '../core';
import Command from '../base';

const log = LogManager.Instance;

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
    await cm.login();
    const parameterService = new ParameterService(this.getDb());
    await parameterService.runSearch(allValues, flags.remote);
  }
}
