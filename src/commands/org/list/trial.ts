import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import { querySignupRequests, type SignupRequest } from "../../../lib/signup-request.js";

export default class OrgListTrial extends SfCommand<SignupRequest[]> {
  public static readonly summary = "List trial org SignupRequests from a Trialforce Management Org";
  public static readonly examples = ["<%= config.bin %> <%= command.id %> --target-org myTMO"];

  public static readonly flags = {
    "target-org": Flags.requiredOrg({
      char: "o",
      summary: "Trialforce Management Org (TMO) to query",
      required: true,
    }),
    limit: Flags.integer({
      summary: "SOQL LIMIT",
      default: 20,
    }),
  };

  public async run(): Promise<SignupRequest[]> {
    const { flags } = await this.parse(OrgListTrial);
    const tmoConn = flags["target-org"].getConnection();
    const records = await querySignupRequests(tmoConn, flags.limit);
    this.table({
      data: records,
      columns: [
        { key: "Id", name: "ID" },
        { key: "CreatedDate", name: "CREATED DATE" },
        { key: "Status", name: "STATUS" },
        { key: "ErrorCode", name: "ERROR CODE" },
        { key: "Country", name: "COUNTRY" },
        { key: "SignupEmail", name: "SIGNUP EMAIL" },
        { key: "Subdomain", name: "SUBDOMAIN" },
        { key: "Username", name: "USERNAME" },
      ],
    });
    return records;
  }
}
