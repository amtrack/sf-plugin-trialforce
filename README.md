# sf-plugin-trialforce

A Salesforce CLI plugin for creating trial orgs.

Requires a Trialforce Management Org (TMO) or Environment Hub org authenticated in the CLI.

## Install

```shell
sf plugins install sf-plugin-trialforce
```

## Commands

<!-- commands -->
* [`sf org create trial`](#sf-org-create-trial)
* [`sf org list trial`](#sf-org-list-trial)
* [`sf org resume trial`](#sf-org-resume-trial)
* [`sf trialforce list template`](#sf-trialforce-list-template)

## `sf org create trial`

Create a Salesforce trial org using a SignupRequest

```
USAGE
  $ sf org create trial -o <value> [--json] [--flags-dir <value>] [-f <value>] [--template-id <value>] [--edition
    <value>] [--company <value>] [--country <value>] [--signup-email <value>] [--first-name <value>] [--last-name
    <value>] [--username <value>] [--subdomain <value>] [--should-connect-to-env-hub] [--trial-days <value>]
    [--preferred-language <value>] [--signup-source <value>] [-a <value>] [-d] [--async] [-w <minutes>]

FLAGS
  -a, --alias=<value>            Alias to set for the created trial org
  -d, --set-default              Set the created trial org as your default org
  -f, --definition-file=<value>  Path to a JSON file with SignupRequest field values; CLI flags override file values
  -o, --target-org=<value>       (required) Trialforce Management Org (TMO) or Environment Hub org that will create the
                                 trial
  -w, --wait=<minutes>           Number of minutes to wait for the trial org to be created
      --async                    Submit the SignupRequest and return immediately without waiting for org creation

SIGNUP REQUEST FLAGS
  --company=<value>             Company name for the trial org admin
  --country=<value>             ISO 2-letter country code for the trial org admin
  --edition=<value>             Salesforce edition for the trial org.
  --first-name=<value>          First name of the trial org admin
  --last-name=<value>           Last name of the trial org admin
  --preferred-language=<value>  Preferred language locale for the trial org (e.g. en_US, de, fr)
  --should-connect-to-env-hub   Connect the created org to the Environment Hub
  --signup-email=<value>        Email address for the trial org admin
  --signup-source=<value>       Identifies the source of the signup request
  --subdomain=<value>           My Domain subdomain prefix for the trial org
  --template-id=<value>         The 15-character ID of the Trialforce template that is the basis for the trial sign-up
                                (0TT...).
  --trial-days=<value>          Number of days the trial org should be active
  --username=<value>            Username for the trial org admin

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

EXAMPLES
  $ sf org create trial --target-org myTMO --definition-file trial-def.json

  $ sf org create trial --target-org myTMO --template-id 0TTxx0000000001 --company Acme --country US --email admin@example.com --last-name Doe --username admin@example.com.trial

  $ sf org create trial --target-org myTMO --definition-file trial-def.json --async

FLAG DESCRIPTIONS
  --edition=<value>  Salesforce edition for the trial org.

    If you don't specify a template ID, an edition is required.

  --template-id=<value>

    The 15-character ID of the Trialforce template that is the basis for the trial sign-up (0TT...).

    Salesforce must approve the template. If you don't specify an edition, a template ID is required.
```

_See code: [lib/commands/org/create/trial.js](https://github.com/amtrack/sf-plugin-trialforce/blob/v0.0.0-development/lib/commands/org/create/trial.js)_

## `sf org list trial`

List trial org SignupRequests from a Trialforce Management Org

```
USAGE
  $ sf org list trial -o <value> [--json] [--flags-dir <value>] [--limit <value>]

FLAGS
  -o, --target-org=<value>  (required) Trialforce Management Org (TMO) to query
      --limit=<value>       [default: 20] SOQL LIMIT

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

EXAMPLES
  $ sf org list trial --target-org myTMO
```

_See code: [lib/commands/org/list/trial.js](https://github.com/amtrack/sf-plugin-trialforce/blob/v0.0.0-development/lib/commands/org/list/trial.js)_

## `sf org resume trial`

Resume polling for a trial org creation that was started with --async

```
USAGE
  $ sf org resume trial -o <value> -i <value> [--json] [--flags-dir <value>] [-a <value>] [-d] [-w <minutes>]

FLAGS
  -a, --alias=<value>              Alias to set for the created trial org
  -d, --set-default                Set the created trial org as your default org
  -i, --signup-request-id=<value>  (required) ID of the SignupRequest record to resume (returned by org create trial
                                   --async)
  -o, --target-org=<value>         (required) Trialforce Management Org (TMO) that submitted the original SignupRequest
  -w, --wait=<minutes>             Number of minutes to wait for the trial org to be created

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

EXAMPLES
  $ sf org resume trial --target-org myTMO --signup-request-id 0SR...

  $ sf org resume trial --target-org myTMO --signup-request-id 0SR... --alias myTrialOrg --set-default
```

_See code: [lib/commands/org/resume/trial.js](https://github.com/amtrack/sf-plugin-trialforce/blob/v0.0.0-development/lib/commands/org/resume/trial.js)_

## `sf trialforce list template`

List Trialforce templates from a Trialforce Source Organization (TSO)

```
USAGE
  $ sf trialforce list template -o <value> [--json] [--flags-dir <value>] [--latest]

FLAGS
  -o, --target-org=<value>  (required) Trialforce Source Organization (TSO) to query
      --latest              Show only the Id of the latest template

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

EXAMPLES
  $ sf trialforce list template --target-org myTMO

  $ sf trialforce list template --target-org myTMO --latest
```

_See code: [lib/commands/trialforce/list/template.js](https://github.com/amtrack/sf-plugin-trialforce/blob/v0.0.0-development/lib/commands/trialforce/list/template.js)_
<!-- commandsstop -->

## Definition file format

```json
{
  "templateId": "0TTxx0000000001",
  "company": "Acme",
  "country": "US",
  "email": "admin@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "username": "admin@example.com.trial",
  "trialDays": 30
}
```

## Development

```shell
npm ci
./bin/dev.js org create trial --help
```

Or link into the CLI:

```shell
sf plugins link
sf org create trial --help
```

## Testing

```shell
npm test
```
