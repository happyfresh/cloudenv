/* eslint-disable complexity */
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
import inquirer from 'inquirer';

export default abstract class BaseCommand extends Command {
  protected Db: LocalDb | undefined;

  static strict = false;

  static flags = {
    columns: flags.string({
      exclusive: ['additional'],
      description: 'Only show provided columns (comma-separated)',
    }),
    sort: flags.string({
      description: "Property to sort by (prepend ' - ' for descending)",
    }),
    filter: flags.string({
      description: 'Filter property by partial string matching, ex: name=foo',
    }),
    csv: flags.boolean({
      exclusive: ['no-truncate'],
      description: 'Output is csv format',
    }),
    extended: flags.boolean({ char: 'x', description: 'show extra columns' }),
    truncate: flags.boolean({
      exclusive: ['csv'],
      description: 'Truncate output to fit screen',
      allowNo: true,
    }),
    header: flags.boolean({
      exclusive: ['csv'],
      description: 'Show / hide table header from output',
      allowNo: true,
    }),
    noInteractive: flags.boolean({
      char: 'y',
      description:
        'Disable interactive input queries (useful if you want to run in scripts)',
    }),
    dotenvFile: flags.string({
      description: 'A dotenv file to load environment variables from.',
    }),
    configFile: flags.string({
      description: 'A config file to load configurations from.',
      default: 'config.yaml',
    }),
    password: flags.string({
      char: 'p',
      description: 'Password to decrypt local cache',
      required: false,
    }),
    setPassword: flags.string({
      description: 'Set a new password, this will create a new local cache',
      required: false,
      exclusive: ['password'],
    }),
    logLevel: flags.string({
      char: 'l',
      description: 'Set the log level',
      required: false,
      options: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    }),
    cacheName: flags.string({
      char: 'c',
      description: 'The name of the cache',
      required: false,
    }),
    awsProfile: flags.string({
      description: 'Use credentials from the aws profile',
      required: false,
    }),
    awsRegion: flags.string({
      description: 'Set the aws region',
      required: false,
    }),
    awsLogging: flags.string({
      description: 'Enable logging output from the aws sdk',
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
      .findPaths(`cloudenv/${cacheName}`)
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
        dataPath = path.resolve(root.path, `cloudenv/${cacheName}`);
      } else {
        dataPath = path.join(
          envPaths('cloudenv', { suffix: '' }).data,
          cacheName
        );
      }
      cacheFullPath = dataPath;
      newDatabaseFlag = true;
    }

    let newPassword: string | undefined;
    // if new database and no setPassword is given
    if (newDatabaseFlag) {
      const validator = (value: string) => {
        const pass = value.length >= 4;
        if (pass) {
          return true;
        }

        return 'Please enter a password longer than four characters';
      };

      const questions = [
        {
          type: 'password',
          name: 'firstPassword',
          mask: '*',
          message:
            "A new cache database was created and --setPassword wasn't set,\nplease enter a password for the new cache database",
          validate: validator,
        },
        {
          type: 'password',
          name: 'secondPassword',
          mask: '*',
          message: 'Please re-enter your password',
          validate: validator,
        },
      ];

      let inputPassword: string | undefined;
      if (!flags.setPassword) {
        const { firstPassword, secondPassword } = await inquirer.prompt(
          questions
        );
        if (firstPassword !== secondPassword) {
          log.error('Password fields did not match, creation of cache aborted');
          this.exit(1);
        }
        inputPassword = firstPassword;
      }

      newPassword = inputPassword ?? flags.setPassword;
      fs.mkdirSync(cacheFullPath, { recursive: true });
      this.Db = new LocalDb();
      await this.Db.openDatabase(cacheFullPath);
      await this.Db.setNewDatabasePassword(newPassword as string);
    } else if (!newDatabaseFlag && flags.setPassword) {
      try {
        // check to see if interactive mode disabled

        const questions = [
          {
            type: 'confirm',
            name: 'input',
            message: `a cache file at ${cacheFullPath} already exists,\nsetting a new password will delete the old cache, continue?`,
            default: false,
          },
        ];

        if (!OpsConfig.get('noInteractive')) {
          const { input } = await inquirer.prompt(questions);
          if (!input) {
            log.warn('Setting new password (replacing cache) aborted');
            this.exit(1);
          }
        }

        fs.rmdirSync(cacheFullPath, { recursive: true });
        this.Db = new LocalDb();
        await this.Db.openDatabase(cacheFullPath);
        await this.Db.setNewDatabasePassword(flags.setPassword);
      } catch (error) {
        log.error(error);
      }
    } else if (!OpsConfig.get('password') && !flags.setPassword) {
      this.error('need a password', {
        exit: 1,
        suggestions: [
          'please provide a password in the config.yaml file or with the --password or --setPassword flag (or CLOUDENV_PASSWORD environment variable)',
        ],
      });
    } else {
      this.Db = new LocalDb();
      await this.Db.openDatabase(cacheFullPath);
    }

    const password =
      flags?.setPassword || newPassword || OpsConfig.get('password');

    // test if password works
    if (!this.Db) {
      this.error('failed to initialize database', { exit: 1 });
    }
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

  async finally(error: any) {
    if (this.Db) {
      await this.Db?.close();
    }
    return super.finally(error);
  }
}
