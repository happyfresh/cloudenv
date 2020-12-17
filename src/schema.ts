export const schema = {
  password: {
    doc: 'The password for data stored in db cache',
    format: '*',
    default: 'password',
    sensitive: true,
    env: 'CLOUDENV_PASSWORD',
    arg: 'password',
  },
  remote: {
    doc: 'Check remote state and download new values',
    format: Boolean,
    default: true,
    env: 'CLOUDENV_REMOTE',
    arg: 'remote',
  },
  glob: {
    doc: 'Use glob and regex patterns instead of simple matching',
    format: Boolean,
    default: false,
    env: 'CLOUDENV_GLOB',
    arg: 'glob',
  },
  noInteractive: {
    doc:
      'Disable interactive input queries (useful if you want to run in scripts)',
    format: Boolean,
    default: false,
    env: 'CLOUDENV_NOINTERACTIVE',
    arg: 'noInteractive',
  },
  freshRemoteReminder: {
    doc: 'The password for data stored in db cache',
    format: 'duration',
    default: '5 minutes',
    env: 'CLOUDENV_FRESHREMOTEREMINDER',
    arg: 'freshRemoteReminder',
  },
  logLevel: {
    doc: 'The log level.',
    format: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    default: 'info',
    env: 'CLOUDENV_LOGLEVEL',
    arg: 'logLevel',
  },
  cacheName: {
    doc: 'The name of the cache',
    format: String,
    default: 'cloudenvDb',
    env: 'CLOUDENV_CACHENAME',
    arg: 'cacheName',
  },
  output: {
    columns: {
      doc: 'only show provided columns (comma-separated)',
      format: String,
      default: undefined,
      arg: 'columns',
    },
    sort: {
      doc: "property to sort by (prepend '-' for descending)",
      format: String,
      default: undefined,
      arg: 'sort',
    },
    filter: {
      doc: 'filter property by partial string matching, ex: name=foo',
      format: String,
      default: undefined,
      arg: 'filter',
    },
    csv: {
      doc: 'output is csv format',
      format: Boolean,
      default: false,
      arg: 'csv',
    },
    extended: {
      doc: 'show extra columns',
      format: Boolean,
      default: true,
      arg: 'extended',
    },
    truncate: {
      doc: 'only show provided columns (comma-separated)',
      format: Boolean,
      default: true,
      arg: 'truncate',
    },
    header: {
      doc: 'only show provided columns (comma-separated)',
      format: Boolean,
      default: true,
      arg: 'header',
    },
  },
  aws: {
    logging: {
      doc: 'enable / disable logging from AWS SDK',
      format: Boolean,
      default: false,
      env: 'CLOUDENV_AWS_LOGGING',
      arg: 'awsLogging',
    },
    profile: {
      doc: 'The name of the aws profile to get credentials from',
      format: String,
      default: '',
      env: 'AWS_PROFILE',
      arg: 'awsProfile',
    },
    accessKeyId: {
      doc: 'The aws access key Id credentials to use',
      format: String,
      default: '',
      env: 'AWS_ACCESS_KEY_ID',
    },
    secretAccessKey: {
      doc: 'The aws secret access key credentials to use',
      format: String,
      sensitive: true,
      default: '',
      env: 'AWS_SECRET_ACCESS_KEY',
    },
    region: {
      doc: 'The aws default region to use',
      format: String,
      default: '',
      env: 'AWS_REGION',
      arg: 'awsRegion',
    },
  },
};
