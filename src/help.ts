import Help from '@oclif/plugin-help';
import { Command } from '@oclif/config';
import { log } from './util';
import { OpsConfig } from 'ops-config';
import indent from 'indent-string';
import { bold } from 'chalk';

export default class CloudenvHelpClass extends Help {
  // display help for a command
  showCommandHelp(command: Command): void {
    super.showCommandHelp(command);

    log.noFormatting(
      [
        bold('CONFIGURATION SCHEMA'),
        indent(
          'The configuration value used in order of precedence is :\n\n1. The commandline argument\n2. Environment variables\n3. Values specified in configuration file\n4. Lastly, configuration file default values.',
          2
        ),
        indent(
          '\nInvoke the command `cloudenv info --schema` to print the configuration schema.\n',
          2
        ),
      ].join('\n')
    );
  }
}
