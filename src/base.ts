/* eslint-disable indent */
import Command, { flags } from '@oclif/command';
import { LocalDb } from './core';
import { LogManager } from './util';

const log = LogManager.Instance;

export default abstract class BaseCommand extends Command {
  private Db: LocalDb | undefined;

  static strict = false;

  static flags = {
    password: flags.string({
      char: 'p',
      description: 'password to decrypt local cache',
      required: false,
      env: 'SEARCHER_PASSWORD',
    }),
    setPassword: flags.string({
      description: 'set a new password, this will create a new local cache',
      required: false,
      exclusive: ['password'],
    }),
    logLevel: flags.string({
      char: 'l',
      description: 'set the log level',
      required: false,
      default: 'info',
      options: ['info', 'debug'],
    }),
  };

  // static args = [];

  public getDb(): LocalDb {
    if (this.Db === undefined) {
      log.debug('Db not yet initialized');
      this.exit(2);
    }
    return this.Db;
  }

  async init() {
    // do some initialization
    const { flags } = this.parse(BaseCommand);

    // setup logging
    if (flags.logLevel) {
      LogManager.Instance.setLogger(flags.logLevel);
      LogManager.Instance.setAwsLogger(flags.logLevel);
    }

    // initialize database
    this.Db = new LocalDb();
    this.Db.openDatabase(this.config.dataDir);

    if (!flags.password && !flags.setPassword) {
      this.error('need a password', {
        exit: 1,
        suggestions: [
          'please provide a password either with the --password or --setPassword flag (or SEARCH_PASSWORD environment variable)',
        ],
      });
    }

    const password = flags?.setPassword || flags?.password;

    if (flags.setPassword !== undefined) {
      this.Db.deleteDatabase(this.config.dataDir);
      await this.Db.setDatabasePassword(flags.setPassword);
    }

    // test if password works
    const passwordOk = await this.Db.checkDatabasePassword(password as string);

    if (!passwordOk) {
      this.error('wrong password', {
        exit: 1,
        suggestions: [
          'please use another password with --password or set a new password with --setPassword (this will create a new cache)',
        ],
      });
    }
  }

  async catch(error: any) {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(error);
  }
}
