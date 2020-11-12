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

  private constructor() {
    this._loggers = new winston.Container();
    this._loggers.add('info', {
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: () => {
            return moment().format('YYYY-MM-DD HH:mm:ss');
          },
        }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const printed = `${timestamp} ${level}: ${formatMessage(
            message
          )} ${formatMeta(meta)}`;
          return printed;
        })
      ),
      transports: [new winston.transports.Console()],
    });
    this._loggers.add('debug', {
      level: 'debug',
      format: winston.format.combine(
        winston.format.errors({ stack: false }),
        winston.format.colorize(),
        winston.format.timestamp({
          format: () => {
            return moment().format('YYYY-MM-DD HH:mm:ss');
          },
        }),
        winston.format.printf(
          ({ level, message, timestamp, stack, ...meta }) => {
            let printed = `${timestamp} ${level}: ${formatMessage(
              message
            )} ${formatMeta(meta)}`;
            if (stack) {
              printed += `- ${stack}`;
            }
            return printed;
          }
        )
      ),
      // transports: [new winston.transports.Console()],
      transports: [new winston.transports.Console()],
    });
    this._loggers.add('outputDebug', {
      level: 'debug',
      format: winston.format.prettyPrint(),
      transports: [new winston.transports.Console()],
    });

    this._loggers.add('output', {
      level: 'info',
      format: winston.format.prettyPrint(),
      transports: [new winston.transports.Console()],
    });

    if (process.env.NODE_ENV === 'development') {
      this._usedLogger = this._loggers.get('debug');
      this._awsUsedLogger = this._loggers.get('debug');
    } else {
      this._usedLogger = this._loggers.get('info');
      this._awsUsedLogger = this._loggers.get('info');
    }
  }

  public static get Instance() {
    // eslint-disable-next-line no-return-assign
    const instance = this._instance || (this._instance = new this());
    return instance;
  }

  public get loggers(): winston.Container {
    return this._loggers;
  }

  public get initialized() {
    return this._initialized;
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

  public jsonDebug(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._loggers.get('outputDebug').debug(message);
    } else {
      this._loggers.get('outputDebug').debug(message, meta);
    }
  }

  public json(message: string | any, ...meta: any | any[]) {
    if (meta.length === 0) {
      this._loggers.get('output').info(message);
    } else {
      this._loggers.get('output').info(message, meta);
    }
  }

  /* public info(...args: any[]) {
    const argus = args as [object];
    // eslint-disable-next-line no-useless-call
    return this._usedLogger.info.apply(this._usedLogger, [...argus]);
  } */
  public awsDebug(message: string | any, ...meta: any | any[]) {
    /* this.resetTailCanvas();
    if (typeof meta === 'undefined') {
      this._awsUsedLogger.debug(message);
    } else if (typeof message === 'string' && typeof meta !== 'undefined') {
      this._awsUsedLogger.debug(message, meta);
    } else {
      this._awsUsedLogger.debug(message);
    }
    this.renderTailCanvas(); */
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

  public setAwsLogger(loggerName: string) {
    this._awsUsedLogger = this._loggers.get(loggerName);
  }

  public getAwsLogger(): Logger {
    return this._awsUsedLogger;
  }
}

const awsLogger = LogManager.Instance;

class AWSWinstonAdapter {
  public static log(...args: [object]) {
    // eslint-disable-next-line no-useless-call
    return awsLogger.awsDebug.apply(awsLogger, [...args]);
  }
}

AWS.config.logger = AWSWinstonAdapter;

export const log = LogManager.Instance;
