import * as winston from 'winston';
import * as AWS from 'aws-sdk';

export type Logger = winston.Logger;

interface LoggerDict {
  [key: string]: Logger;
}

// singleton
export class LogManager {
  private static _instance: LogManager;

  private _loggers: winston.Container;

  private _usedLogger: Logger;

  private _awsUsedLogger: Logger;

  private constructor() {
    this._loggers = new winston.Container();
    this._loggers.add('info', {
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
      transports: [new winston.transports.Console()],
    });
    this._loggers.add('debug', {
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
      transports: [new winston.transports.Console()],
    });
    this._loggers.add('output', {
      level: 'debug',
      format: winston.format.prettyPrint(),
      transports: [new winston.transports.Console()],
    });
    this._loggers.add('jsonFile', {
      level: 'debug',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({
          filename: 'network.json',
        }),
      ],
    });

    this._usedLogger = this._loggers.get('info');
    this._awsUsedLogger = this._loggers.get('info');
  }

  public static get Instance() {
    // eslint-disable-next-line no-return-assign
    return this._instance || (this._instance = new this());
  }

  public get loggers(): winston.Container {
    return this._loggers;
  }

  public setLogger(loggerName: string) {
    this._usedLogger = this._loggers.get(loggerName);
  }

  public getLogger(): Logger {
    return this._usedLogger;
  }

  public info(...args: any[]) {
    const argus = args as [object];
    // eslint-disable-next-line no-useless-call
    return this._usedLogger.info.apply(this._usedLogger, [...argus]);
  }

  public debug(...args: any[]) {
    const argus = args as [object];
    // eslint-disable-next-line no-useless-call
    return this._usedLogger.debug.apply(this._usedLogger, [...argus]);
  }

  public warn(...args: any[]) {
    const argus = args as [object];
    // eslint-disable-next-line no-useless-call
    return this._usedLogger.warn.apply(this._usedLogger, [...argus]);
  }

  public verbose(...args: any[]) {
    const argus = args as [object];
    // eslint-disable-next-line no-useless-call
    return this._usedLogger.verbose.apply(this._usedLogger, [...argus]);
  }

  public error(...args: any[]) {
    const argus = args as [object];
    // eslint-disable-next-line no-useless-call
    return this._usedLogger.error.apply(this._usedLogger, [...argus]);
  }

  public setAwsLogger(loggerName: string) {
    this._awsUsedLogger = this._loggers.get(loggerName);
  }

  public getAwsLogger(): Logger {
    return this._awsUsedLogger;
  }
}

const awsLogger = LogManager.Instance.getAwsLogger().child({
  class: 'AWS',
});

class AWSWinstonAdapter {
  public static log(...args: [object]) {
    // eslint-disable-next-line no-useless-call
    return awsLogger.debug.apply(awsLogger, [...args]);
  }
}

AWS.config.logger = AWSWinstonAdapter;
