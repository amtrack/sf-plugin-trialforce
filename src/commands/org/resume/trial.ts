import { Duration } from "@salesforce/kit";
import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import { exchangeAuthCode, resolveMyDomain, waitForOrgReady } from "../../../lib/org-auth.js";
import { CompletedSignupRequest, pollSignupRequest } from "../../../lib/signup-request.js";

export default class OrgResumeTrial extends SfCommand<CompletedSignupRequest> {
  public static readonly summary =
    "Resume polling for a trial org creation that was started with --async";
  public static readonly examples = [
    "<%= config.bin %> <%= command.id %> --target-org myTMO --signup-request-id 0SR...",
    "<%= config.bin %> <%= command.id %> --target-org myTMO --signup-request-id 0SR... --alias myTrialOrg --set-default",
  ];

  public static readonly flags = {
    "target-org": Flags.requiredOrg({
      char: "o",
      summary: "Trialforce Management Org (TMO) that submitted the original SignupRequest",
      required: true,
    }),
    "signup-request-id": Flags.string({
      char: "i",
      summary: "ID of the SignupRequest record to resume (returned by org create trial --async)",
      required: true,
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
    wait: Flags.duration({
      char: "w",
      unit: "minutes",
      default: Duration.minutes(60),
      min: 2,
      helpValue: "<minutes>",
      summary: "Number of minutes to wait for the trial org to be created",
    }),
  };

  public async run(): Promise<CompletedSignupRequest> {
    const { flags } = await this.parse(OrgResumeTrial);

    const tmoConn = flags["target-org"].getConnection();
    const signupRequestId = flags["signup-request-id"];

    this.spinner.start("Waiting for trial org to be ready");
    const completed = await pollSignupRequest(tmoConn, signupRequestId, flags.wait);
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

    this.logSuccess("Trial org is ready.");

    return completed;
  }
}
