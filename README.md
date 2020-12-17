# Cloudenv

A command line tool to search through a whole AWS account for environment variables keys and values. Currently supports searching through system manager parameter store and route53 hosted zones.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/aws-env-searcher.svg)](https://npmjs.org/package/aws-env-searcher)
[![CircleCI](https://circleci.com/gh/personal/aws-env-searcher/tree/master.svg?style=shield)](https://circleci.com/gh/personal/aws-env-searcher/tree/master)
[![Codecov](https://codecov.io/gh/personal/aws-env-searcher/branch/master/graph/badge.svg)](https://codecov.io/gh/personal/aws-env-searcher)
[![Downloads/week](https://img.shields.io/npm/dw/aws-env-searcher.svg)](https://npmjs.org/package/aws-env-searcher)
[![License](https://img.shields.io/npm/l/aws-env-searcher.svg)](https://github.com/personal/aws-env-searcher/blob/master/package.json)

<!-- toc -->
* [Cloudenv](#cloudenv)
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
@happyfresh/cloudenv/0.1.1 linux-x64 node-v14.10.1
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

_See code: [src/commands/info.ts](https://github.com/happyfresh/cloudenv/blob/v0.1.1/src/commands/info.ts)_

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

_See code: [src/commands/key.ts](https://github.com/happyfresh/cloudenv/blob/v0.1.1/src/commands/key.ts)_

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

_See code: [src/commands/value.ts](https://github.com/happyfresh/cloudenv/blob/v0.1.1/src/commands/value.ts)_
<!-- commandsstop -->

## Password

Because cloudenv will be downloading potentialy sensitive data, by default all data is encrypted with a password you provide. When you first use cloudenv (or if you specify a different cache name), cloud env will prompt you to create a new password.

You need to provide this password each time you use cloudenv, you can do this through:

1. The command line `cloudenv value --password mypassword <searchstring>`(not recommended as it is in clear text and will be in your shell history).
2. The environment variable `CLOUDENV_PASSWORD`
3. The configuration file with the property `password`

## Configuration

To see where your configuration file should be located, run the `cloudenv info` command. Create a file named config.yaml at the location described by the command (by default cloudenv will search for config.yaml). You could also create different configuration file names (i.e. staging.yaml or production.yaml) with custom configurations for each environment. You would then specify the config file to use by invoking `cloudenv value --configFile staging.yaml <searchstring>` for example.

To see the configuration schema used, invoke `cloudenv info --schema` in the command line.

Below is a minimal example for config files :

```yaml
#staging.yaml
password: mypassword
logLevel: http
cacheName: stagingDb
freshRemoteReminder: 5 minutes
aws:
  profile: staging
  region: ap-southeast-1
  logging: false

#production.yaml
password: mypassword
logLevel: http
cacheName: productionDb
freshRemoteReminder: 5 minutes
aws:
  profile: production
  region: ap-southeast-1
  logging: false
```

As you can see in the example above, AWS specific configurations are grouped under the "aws" property. Cloudenv requires the AWS access key id and secret in order to function. There are several alternative ways to provide this to cloudenv as described in the sections below.

### AWS Profile

Cloudenv will first search for the existence of an environment variable with the name `AWS_PROFILE` containing the name of the AWS profile to be used.

You could also provide the name of the profile through the command line (`--awsProfile`) or in the configuration file (as can be seen from the example above).

Please see the following documentation from AWS regarding how to set your AWS profile in your local computer : https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

### AWS Access Key and Secret

You can provide the AWS access key and secret using the same environment variables that would be used by the AWS CLI, by setting the following environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. You can also configure it in the configuration file :

```yaml
aws:
  accessKeyId: XXXXXX
  secreteAccessKey: XXXXX
```

There is (purposefully) no equivalent commandline argument available.

### AWS Region

You must provide the AWS region to be used, this can be done through environment variable `AWS_REGION`, commandline argument `--awsRegion` and through the configuration file :

```yaml
aws:
  region: ap-southeast-1
```
