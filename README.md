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
$ npm install -g cloudenv
$ cloudenv COMMAND
running command...
$ cloudenv (-v|--version|version)
cloudenv/0.0.0 darwin-x64 node-v14.8.0
$ cloudenv --help [COMMAND]
USAGE
  $ cloudenv COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`cloudenv help [COMMAND]`](#cloudenv-help-command)
* [`cloudenv key KEY [ADDITIONALKEYS]`](#cloudenv-key-key-additionalkeys)
* [`cloudenv ls`](#cloudenv-ls)
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

## `cloudenv key KEY [ADDITIONALKEYS]`

find the environment variable value(s) given its key(s)

```
USAGE
  $ cloudenv key KEY [ADDITIONALKEYS]

ARGUMENTS
  KEY             the environment variable key (glob pattern) to search for
  ADDITIONALKEYS  additional environment variable key (glob patterns) to search for

OPTIONS
  -h, --help                 show CLI help
  -l, --logLevel=info|debug  [default: info] set the log level
  -p, --password=password    password to decrypt local cache
  -r, --[no-]remote          check remote state and download new values
  -v, --version              show CLI version
  --setPassword=setPassword  set a new password, this will create a new local cache
```

_See code: [src/commands/key.ts](https://github.com/personal/cloudenv/blob/v0.0.0/src/commands/key.ts)_

## `cloudenv ls`

list items from the local database cache

```
USAGE
  $ cloudenv ls

OPTIONS
  -h, --help                 show CLI help
  -l, --logLevel=info|debug  [default: info] set the log level
  -p, --password=password    password to decrypt local cache
  --setPassword=setPassword  set a new password, this will create a new local cache

EXAMPLE
  $ cloudenv ls
```

_See code: [src/commands/ls.ts](https://github.com/personal/cloudenv/blob/v0.0.0/src/commands/ls.ts)_

## `cloudenv value VALUE [ADDITIONALVALUES]`

find the environment variable key(s) given its value

```
USAGE
  $ cloudenv value VALUE [ADDITIONALVALUES]

ARGUMENTS
  VALUE             the environment variable value (glob pattern) to search for
  ADDITIONALVALUES  additional environment variable values (glob patterns) to search for

OPTIONS
  -h, --help                 show CLI help
  -l, --logLevel=info|debug  [default: info] set the log level
  -p, --password=password    password to decrypt local cache
  -r, --[no-]remote          check remote state and download new values
  -v, --version              show CLI version
  --setPassword=setPassword  set a new password, this will create a new local cache
```

_See code: [src/commands/value.ts](https://github.com/personal/cloudenv/blob/v0.0.0/src/commands/value.ts)_
<!-- commandsstop -->
