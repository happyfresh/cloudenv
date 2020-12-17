aws-env-searcher
================

A command line tool to search through a whole AWS account for environment variables keys and values.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/aws-env-searcher.svg)](https://npmjs.org/package/aws-env-searcher)
[![CircleCI](https://circleci.com/gh/personal/aws-env-searcher/tree/master.svg?style=shield)](https://circleci.com/gh/personal/aws-env-searcher/tree/master)
[![Codecov](https://codecov.io/gh/personal/aws-env-searcher/branch/master/graph/badge.svg)](https://codecov.io/gh/personal/aws-env-searcher)
[![Downloads/week](https://img.shields.io/npm/dw/aws-env-searcher.svg)](https://npmjs.org/package/aws-env-searcher)
[![License](https://img.shields.io/npm/l/aws-env-searcher.svg)](https://github.com/personal/aws-env-searcher/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @happyfresh/cloudenv
$ cloudenv COMMAND
running command...
$ cloudenv (-v|--version|version)
@happyfresh/cloudenv/0.1.0 linux-x64 node-v14.10.1
$ cloudenv --help [COMMAND]
USAGE
  $ cloudenv COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`cloudenv help [COMMAND]`](#cloudenv-help-command)
* [`cloudenv info`](#cloudenv-info)
* [`cloudenv key KEY [ADDITIONALKEYS]`](#cloudenv-key-key-additionalkeys)
* [`cloudenv value VALUE [ADDITIONALVALUES]`](#cloudenv-value-value-additionalvalues)

## `cloudenv help [COMMAND]`

display help for cloudenv

```
USAGE
  $ cloudenv help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.0/src/commands/help.ts)_

## `cloudenv info`

Print cache data and diagnostics

```
USAGE
  $ cloudenv info

OPTIONS
  -c, --cacheName=cacheName                                The name of the cache
  -h, --help                                               show CLI help
  -l, --logLevel=error|warn|info|http|verbose|debug|silly  Set the log level
  -p, --password=password                                  Password to decrypt local cache
  -v, --version                                            show CLI version
  -x, --extended                                           show extra columns

  -y, --noInteractive                                      Disable interactive input queries (useful if you want to run
                                                           in scripts)

  --awsLogging=awsLogging                                  Enable logging output from the aws sdk

  --awsProfile=awsProfile                                  Use credentials from the aws profile

  --awsRegion=awsRegion                                    Set the aws region

  --columns=columns                                        Only show provided columns (comma-separated)

  --configFile=configFile                                  [default: config.yaml] A config file to load configurations
                                                           from.

  --csv                                                    Output is csv format

  --dotenvFile=dotenvFile                                  A dotenv file to load environment variables from.

  --filter=filter                                          Filter property by partial string matching, ex: name=foo

  --[no-]header                                            Show / hide table header from output

  --schema

  --setPassword=setPassword                                Set a new password, this will create a new local cache

  --sort=sort                                              Property to sort by (prepend ' - ' for descending)

  --[no-]truncate                                          Truncate output to fit screen
```

_See code: [src/commands/info.ts](https://github.com/happyfresh/cloudenv/blob/v0.1.0/src/commands/info.ts)_

## `cloudenv key KEY [ADDITIONALKEYS]`

Find the environment variable value(s) given its key(s)

```
USAGE
  $ cloudenv key KEY [ADDITIONALKEYS]

ARGUMENTS
  KEY             The environment variable key (glob pattern) to search for
  ADDITIONALKEYS  Additional environment variable key (glob patterns) to search for

OPTIONS
  -c, --cacheName=cacheName                                The name of the cache
  -g, --[no-]glob                                          Use glob and regex patterns instead of simple matching
  -h, --help                                               show CLI help
  -l, --logLevel=error|warn|info|http|verbose|debug|silly  Set the log level
  -p, --password=password                                  Password to decrypt local cache
  -r, --[no-]remote                                        Check remote state and download new values
  -v, --version                                            show CLI version
  -w, --writeValue=writeValue                              Overwrite with new value
  -x, --extended                                           show extra columns

  -y, --noInteractive                                      Disable interactive input queries (useful if you want to run
                                                           in scripts)

  --awsLogging=awsLogging                                  Enable logging output from the aws sdk

  --awsProfile=awsProfile                                  Use credentials from the aws profile

  --awsRegion=awsRegion                                    Set the aws region

  --columns=columns                                        Only show provided columns (comma-separated)

  --configFile=configFile                                  [default: config.yaml] A config file to load configurations
                                                           from.

  --csv                                                    Output is csv format

  --dotenvFile=dotenvFile                                  A dotenv file to load environment variables from.

  --filter=filter                                          Filter property by partial string matching, ex: name=foo

  --[no-]header                                            Show / hide table header from output

  --setPassword=setPassword                                Set a new password, this will create a new local cache

  --sort=sort                                              Property to sort by (prepend ' - ' for descending)

  --[no-]truncate                                          Truncate output to fit screen
```

_See code: [src/commands/key.ts](https://github.com/happyfresh/cloudenv/blob/v0.1.0/src/commands/key.ts)_

## `cloudenv value VALUE [ADDITIONALVALUES]`

Find the environment variable key(s) given its value

```
USAGE
  $ cloudenv value VALUE [ADDITIONALVALUES]

ARGUMENTS
  VALUE             The environment variable value (glob pattern) to search for
  ADDITIONALVALUES  Additional environment variable values (glob patterns) to search for

OPTIONS
  -c, --cacheName=cacheName                                The name of the cache
  -g, --[no-]glob                                          Use glob and regex patterns instead of simple matching
  -h, --help                                               show CLI help
  -l, --logLevel=error|warn|info|http|verbose|debug|silly  Set the log level
  -p, --password=password                                  Password to decrypt local cache
  -r, --[no-]remote                                        Check remote state and download new values
  -v, --version                                            show CLI version
  -w, --writeValue=writeValue                              Overwrite with new value
  -x, --extended                                           show extra columns

  -y, --noInteractive                                      Disable interactive input queries (useful if you want to run
                                                           in scripts)

  --awsLogging=awsLogging                                  Enable logging output from the aws sdk

  --awsProfile=awsProfile                                  Use credentials from the aws profile

  --awsRegion=awsRegion                                    Set the aws region

  --columns=columns                                        Only show provided columns (comma-separated)

  --configFile=configFile                                  [default: config.yaml] A config file to load configurations
                                                           from.

  --csv                                                    Output is csv format

  --dotenvFile=dotenvFile                                  A dotenv file to load environment variables from.

  --filter=filter                                          Filter property by partial string matching, ex: name=foo

  --[no-]header                                            Show / hide table header from output

  --setPassword=setPassword                                Set a new password, this will create a new local cache

  --sort=sort                                              Property to sort by (prepend ' - ' for descending)

  --[no-]truncate                                          Truncate output to fit screen
```

_See code: [src/commands/value.ts](https://github.com/happyfresh/cloudenv/blob/v0.1.0/src/commands/value.ts)_
<!-- commandsstop -->
