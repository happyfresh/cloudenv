import { flags } from '@oclif/command';
import { LogManager } from '../util';
import Command from '../base';

const log = LogManager.Instance;

const outputLog = LogManager.Instance.loggers.get('output');
export default class Ls extends Command {
  static description = 'list items from the local database cache';

  static examples = ['$ cloudenv ls'];

  static flags = {
    ...Command.flags,
    help: flags.help({ char: 'h' }),
  };

  async run() {
    log.info('Fetching from encrypted cache...');
    const parameters = await this.getDb().getAllDatabaseKeys();
    outputLog.info(parameters);
  }
}
