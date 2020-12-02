/* eslint-disable no-console */
/* eslint-disable node/no-unsupported-features/node-builtins */
/* eslint-disable operator-linebreak */
import * as winston from 'winston';
import * as AWS from 'aws-sdk';
import moment from 'moment';

export type Logger = winston.Logger;

const formatMeta = (meta: any) => {
  // You can format the splat yourself
  const splat = meta[Symbol.for('splat')];
  if (splat && splat[0].length > 0) {
    return splat.length === 1
      ? JSON.stringify(splat[0]).slice(1, -1)
      : JSON.stringify(splat);
  }
  return '';
};

const formatMessage = (message: any) => {
  if (typeof message === 'string') {
    return message;
  }
  return JSON.stringify(message);
};

// singleton
export class LogManager {
  private static _instance: LogManager;

  private _loggers: winston.Container;

  private _usedLogger: Logger;

  private _awsUsedLogger: Logger;

  private _initialized = false;

  private _enableAWSLogging = false;

  private constructor() {
    this._loggers = new winston.Container();

    this._loggers.add('formatted', {
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: () => {
            return moment().format('HH:mm:ss');
          },
        }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const printed = `${timestamp} ${level}: ${formatMessage(
            message
          )} ${formatMeta(meta)}`;
          return printed;
        })
      ),
      transports: [
        new winston.transports.Console({
          stderrLevels: [
            'error',
            'warn',
            'info',
            'http',
            'verbose',
            'debug',
            'silly',
          ],
        }),
      ],
    });

    this._loggers.add('pretty', {
      level: 'info',
      format: winston.format.prettyPrint(),
      transports: [
        new winston.transports.Console({
          stderrLevels: [
            'error',
            'warn',
            'info',
            'http',
            'verbose',
            'debug',
            'silly',
          ],
        }),
      ],
    });

    this._loggers.add('plain', {
      level: 'info',
      format: winston.format.printf(({ message, ...meta }) => {
        const printed = `${formatMessage(message)} ${formatMeta(meta)}`;
        return printed;
      }),
      transports: [
        new winston.transports.Console({
          stderrLevels: [
            'error',
            'warn',
            'info',
            'http',
            'verbose',
            'debug',
            'silly',
          ],
        }),
      ],
    });

    this._usedLogger = this._loggers.get('formatted');
    this._awsUsedLogger = this._loggers.get('formatted');
  }

  public static get Instance() {
    // eslint-disable-next-line no-return-assign
    const instance = this._instance || (this._instance = new this());
    return instance;
  }

  public get enableAWSLogging(): boolean {
    return this._enableAWSLogging;
  }

  public set enableAWSLogging(enable: boolean) {
    this._enableAWSLogging = enable;
  }

  public get loggers(): winston.Container {
    return this._loggers;
  }

  public get initialized() {
    return this._initialized;
  }

  public setLogLevel(level: string) {
    if (
      !['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].some(
        (value) => value === level
      )
    )
      throw new Error(
        "log level must be one of 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'"
      );
    this._usedLogger.transports[0].level = level;
    this._awsUsedLogger.transports[0].level = level;
  }

  public setLogger(loggerName: string) {
    this._usedLogger = this._loggers.get(loggerName);
  }

  public getLogger(): Logger {
    return this._usedLogger;
  }

  public info(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.info(message);
    } else {
      this._usedLogger.info(message, meta);
    }
  }

  public prettyPrint(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._loggers.get('pretty').info(message);
    } else {
      this._loggers.get('pretty').info(message, meta);
    }
  }

  public noFormatting(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._loggers.get('plain').info(message);
    } else {
      this._loggers.get('plain').info(message, meta);
    }
  }

  public awsDebug(message: string | any, ...meta: any | any[]) {
    if (!this.enableAWSLogging) return;

    if (meta.length === 0) {
      this._awsUsedLogger.debug(message);
    } else {
      this._awsUsedLogger.debug(message, meta);
    }
  }

  public debug(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.debug(message);
    } else {
      this._usedLogger.debug(message, meta);
    }
  }

  public warn(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.warn(message);
    } else {
      this._usedLogger.warn(message, meta);
    }
  }

  public verbose(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.verbose(message);
    } else {
      this._usedLogger.verbose(message, meta);
    }
  }

  public error(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.error(message);
    } else {
      this._usedLogger.error(message, meta);
    }
  }

  public http(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.http(message);
    } else {
      this._usedLogger.http(message, meta);
    }
  }

  public silly(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._usedLogger.silly(message);
    } else {
      this._usedLogger.silly(message, meta);
    }
  }

  public setAwsLogger(loggerName: string) {
    this._awsUsedLogger = this._loggers.get(loggerName);
  }

  public getAwsLogger(): Logger {
    return this._awsUsedLogger;
  }
}

export const log = LogManager.Instance;

class AWSWinstonAdapter {
  public static log(...args: [object]) {
    // eslint-disable-next-line no-useless-call
    return log.awsDebug.apply(log, [...args]);
  }
}

AWS.config.logger = AWSWinstonAdapter;
