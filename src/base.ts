import Command, { flags } from '@oclif/command';
import { LocalDb } from './core';
import { log } from './util';
import { OpsConfig } from 'ops-config';
import { PathPriorityBuilderSync } from 'path-priority';
import 'path-priority/lib/cjs/finders';
import envPaths from 'env-paths';
import root from 'app-root-path';
import path from 'path';
import fs from 'fs';
import { schema } from './schema';
import cli from 'cli-ux';

export default abstract class BaseCommand extends Command {
  protected Db: LocalDb | undefined;

  static strict = false;

  static flags = {
    ...cli.table.flags(),
    dotenvFile: flags.string({
      description: 'a dotenv file to load environment variables from.',
    }),
    configFile: flags.string({
      description: 'a config file to load configurations from.',
      default: 'config.yaml',
    }),
    password: flags.string({
      char: 'p',
      description: 'password to decrypt local cache',
      required: false,
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
      options: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    }),
    cacheName: flags.string({
      char: 'c',
      description: 'the name of the cache',
      required: false,
    }),
    awsProfile: flags.string({
      description: 'use credentials from the aws profile',
      required: false,
    }),
    awsRegion: flags.string({
      description: 'set the aws region',
      required: false,
    }),
    awsLogging: flags.string({
      description: 'enable logging output from the aws sdk',
      required: false,
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
    // const { setPassword, ...restFlags } = flags;
    OpsConfig.init(schema, flags as any);

    if (flags?.dotenvFile) {
      OpsConfig.usePriorityPreset('cli').loadFromPathPriority(
        `ops-config/${flags?.configFile}`,
        `ops-config/${flags?.dotenvFile}`
      );
    } else {
      const configFile = `ops-config/${flags?.configFile}`;
      OpsConfig.usePriorityPreset('cli').loadFromPathPriority(configFile);
    }

    // setup logging
    log.enableAWSLogging = OpsConfig.get('aws.logging');
    const logLevel = OpsConfig.get('logLevel');
    if (logLevel) {
      log.setLogLevel(logLevel);
    }

    // initialize database
    const cacheName = OpsConfig.get('cacheName');
    let cacheFullPath;
    let newDatabaseFlag = false;

    const cacheLocation = new PathPriorityBuilderSync()
      .findPaths(`ops-config/${cacheName}`)
      .ifEnv({ NODE_ENV: '?(development)?(debug)' })
      .appRoot()
      .defaultData()
      .generateSync();

    if (cacheLocation.length > 0) {
      cacheFullPath = cacheLocation[0];
    } else {
      // no database found, should create
      let dataPath;
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'debug'
      ) {
        dataPath = path.resolve(root.path, `ops-config/${cacheName}`);
      } else {
        dataPath = path.join(envPaths('ops-config').data, cacheName);
      }
      cacheFullPath = dataPath;
      newDatabaseFlag = true;
    }

    let newPassword: string | undefined;
    // if new database and no setPassword is given
    if (newDatabaseFlag && !flags.setPassword) {
      const firstPassword = (await cli.prompt(
        "A new cache database was created and --setPassword wasn't set,\nplease enter a password for the new cache database",
        { type: 'hide' }
      )) as string;

      const secondPassword = await cli.prompt('Please re-enter your password', {
        type: 'hide',
      });

      if (firstPassword !== secondPassword) {
        log.error(
          'Password fields did not match, creation of database aborted'
        );
        this.exit(1);
      }
      newPassword = firstPassword;
      fs.mkdirSync(cacheFullPath, { recursive: true });
    }

    this.Db = new LocalDb();
    this.Db.openDatabase(cacheFullPath);

    if (newPassword) {
      await this.Db.setNewDatabasePassword(newPassword);
    } else if (!OpsConfig.get('password') && !flags.setPassword) {
      this.error('need a password', {
        exit: 1,
        suggestions: [
          'please provide a password in the config.yaml file or with the --password or --setPassword flag (or CLOUDENV_PASSWORD environment variable)',
        ],
      });
    }

    if (flags.setPassword !== undefined) {
      try {
        if (fs.existsSync(cacheFullPath)) {
          const input = await cli.prompt(
            `a cache file at ${cacheFullPath} already exists,\nsetting a new password will delete the old cache\ncontinue? (Yes/y or No/n)`
          );
          if (['yes', 'Yes', 'y', 'Y'].some((value) => value === input)) {
            fs.unlinkSync(cacheFullPath);
          } else {
            log.warn('creation of new cache file aborted');
            this.exit(1);
          }
        }
      } catch (error) {
        log.error(error);
      }

      this.Db.openDatabase(cacheFullPath);
      await this.Db.setNewDatabasePassword(flags.setPassword);
    }

    const password =
      flags?.setPassword || newPassword || OpsConfig.get('password');

    // test if password works
    const passwordOk = await this.Db.unlockDatabase(password as string);

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
