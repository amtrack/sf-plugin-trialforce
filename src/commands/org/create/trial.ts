import { Duration } from "@salesforce/kit";
import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import { readFile } from "node:fs/promises";
import { exchangeAuthCode, resolveMyDomain, waitForOrgReady } from "../../../lib/org-auth.js";
import {
  createSignupRequest,
  pollSignupRequest,
  type CompletedSignupRequest,
  type CreatedSignupRequest,
  type SignupRequestInput,
} from "../../../lib/signup-request.js";

const REQUIRED_FIELDS: Array<keyof SignupRequestInput> = [
  "Company",
  "Country",
  "SignupEmail",
  "LastName",
  "Username",
];

export default class OrgCreateTrial extends SfCommand<
  CreatedSignupRequest | CompletedSignupRequest
> {
  public static readonly summary = "Create a Salesforce trial org using a SignupRequest";
  public static readonly examples = [
    "<%= config.bin %> <%= command.id %> --target-org myTMO --definition-file trial-def.json",
    "<%= config.bin %> <%= command.id %> --target-org myTMO --template-id 0TTxx0000000001 --company Acme --country US --email admin@example.com --last-name Doe --username admin@example.com.trial",
    "<%= config.bin %> <%= command.id %> --target-org myTMO --definition-file trial-def.json --async",
  ];

  public static readonly flags = {
    "target-org": Flags.requiredOrg({
      char: "o",
      summary: "Trialforce Management Org (TMO) or Environment Hub org that will create the trial",
      required: true,
    }),
    "definition-file": Flags.file({
      char: "f",
      exists: true,
      summary:
        "Path to a JSON file with SignupRequest field values; CLI flags override file values",
    }),
    "template-id": Flags.string({
      summary:
        "The 15-character ID of the Trialforce template that is the basis for the trial sign-up (0TT...).",
      description:
        "Salesforce must approve the template. If you don't specify an edition, a template ID is required.",
      helpGroup: "Signup Request",
    }),
    edition: Flags.string({
      summary: "Salesforce edition for the trial org.",
      description: "If you don't specify a template ID, an edition is required.",
      helpGroup: "Signup Request",
    }),
    company: Flags.string({
      summary: "Company name for the trial org admin",
      helpGroup: "Signup Request",
    }),
    country: Flags.string({
      summary: "ISO 2-letter country code for the trial org admin",
      helpGroup: "Signup Request",
    }),
    "signup-email": Flags.string({
      summary: "Email address for the trial org admin",
      helpGroup: "Signup Request",
    }),
    "first-name": Flags.string({
      summary: "First name of the trial org admin",
      helpGroup: "Signup Request",
    }),
    "last-name": Flags.string({
      summary: "Last name of the trial org admin",
      helpGroup: "Signup Request",
    }),
    username: Flags.string({
      summary: "Username for the trial org admin",
      helpGroup: "Signup Request",
    }),
    subdomain: Flags.string({
      summary: "My Domain subdomain prefix for the trial org",
      helpGroup: "Signup Request",
    }),
    "should-connect-to-env-hub": Flags.boolean({
      summary: "Connect the created org to the Environment Hub",
      default: true,
      helpGroup: "Signup Request",
    }),
    "trial-days": Flags.integer({
      summary: "Number of days the trial org should be active",
      helpGroup: "Signup Request",
    }),
    "preferred-language": Flags.string({
      summary: "Preferred language locale for the trial org (e.g. en_US, de, fr)",
      helpGroup: "Signup Request",
    }),
    "signup-source": Flags.string({
      summary: "Identifies the source of the signup request",
      helpGroup: "Signup Request",
    }),
    alias: Flags.string({
      char: "a",
      summary: "Alias to set for the created trial org",
    }),
    "set-default": Flags.boolean({
      char: "d",
      summary: "Set the created trial org as your default org",
      default: false,
    }),
    async: Flags.boolean({
      summary: "Submit the SignupRequest and return immediately without waiting for org creation",
      default: false,
    }),
    wait: Flags.duration({
      char: "w",
      unit: "minutes",
      default: Duration.minutes(60),
      min: 2,
      helpValue: "<minutes>",
      summary: "Number of minutes to wait for the trial org to be created",
    }),
  };

  public async run(): Promise<CreatedSignupRequest | CompletedSignupRequest> {
    const { flags } = await this.parse(OrgCreateTrial);

    const fileData = flags["definition-file"]
      ? await loadDefinitionFile(flags["definition-file"])
      : {};

    const merged: SignupRequestInput = {
      ...fileData,
      ...(flags.company !== undefined && { Company: flags.company }),
      ...(flags.country !== undefined && { Country: flags.country }),
      ...(flags.edition !== undefined && { Edition: flags.edition }),
      ...(flags["first-name"] !== undefined && { FirstName: flags["first-name"] }),
      ...(flags["last-name"] !== undefined && { LastName: flags["last-name"] }),
      ...(flags["preferred-language"] !== undefined && {
        PreferredLanguage: flags["preferred-language"],
      }),
      ...(flags["signup-email"] !== undefined && { SignupEmail: flags["signup-email"] }),
      ...(flags["signup-source"] !== undefined && { SignupSource: flags["signup-source"] }),
      ...(flags["should-connect-to-env-hub"] !== undefined && {
        ShouldConnectToEnvHub: flags["should-connect-to-env-hub"],
      }),
      ...(flags.subdomain !== undefined && { Subdomain: flags.subdomain }),
      ...(flags["template-id"] !== undefined && { TemplateId: flags["template-id"] }),
      ...(flags["trial-days"] !== undefined && { TrialDays: flags["trial-days"] }),
      ...(flags.username !== undefined && { Username: flags.username }),
    };

    validateRequiredFields(merged);

    const tmo = flags["target-org"];
    const tmoConn = tmo.getConnection();

    this.spinner.start("Submitting SignupRequest");
    const created = await createSignupRequest(tmoConn, merged);
    this.spinner.stop();

    if (flags.async) {
      this.info(
        `SignupRequest submitted with ID: ${created.Id}\nResume with: ${this.config.bin} org resume trial --target-org ${tmo.getUsername() ?? ""} --signup-request-id ${created.Id}`,
      );
      return created;
    }

    this.spinner.start("Waiting for trial org to be ready");
    const completed = await pollSignupRequest(tmoConn, created.Id, flags.wait);
    this.spinner.stop();

    this.spinner.start("Resolving MyDomain");
    await resolveMyDomain(completed.Subdomain);
    this.spinner.stop();

    this.spinner.start("Waiting for org to be ready");
    await waitForOrgReady(completed.Subdomain);
    this.spinner.stop();

    this.spinner.start("Authenticating");
    const authInfo = await exchangeAuthCode(completed);
    await authInfo.handleAliasAndDefaultSettings({
      alias: flags.alias,
      setDefault: flags["set-default"],
      setDefaultDevHub: false,
    });
    this.spinner.stop();

    this.logSuccess("Trial org created successfully.");

    return completed;
  }
}

async function loadDefinitionFile(filePath: string): Promise<SignupRequestInput> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as SignupRequestInput;
}

function validateRequiredFields(data: SignupRequestInput): void {
  const missing = REQUIRED_FIELDS.filter(
    (f) => data[f] === undefined || data[f] === null || data[f] === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required SignupRequest fields: ${missing.join(", ")}. Provide them via flags or --definition-file.`,
    );
  }
  if (!data.TemplateId && !data.Edition) {
    throw new Error(
      "Either --template-id or --edition is required. Provide one via flags or --definition-file.",
    );
  }
}
