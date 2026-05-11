import { Flags, SfCommand } from "@salesforce/sf-plugins-core";
import { queryTrialTemplates, type TrialTemplate } from "../../../lib/trial-template.js";

export default class TrialforceListTemplate extends SfCommand<TrialTemplate[]> {
  public static readonly summary =
    "List Trialforce templates from a Trialforce Source Organization (TSO)";
  public static readonly examples = [
    "<%= config.bin %> <%= command.id %> --target-org myTMO",
    "<%= config.bin %> <%= command.id %> --target-org myTMO --latest",
  ];

  public static readonly flags = {
    "target-org": Flags.requiredOrg({
      char: "o",
      summary: "Trialforce Source Organization (TSO) to query",
      required: true,
    }),
    latest: Flags.boolean({
      summary: "Show only the Id of the latest template",
    }),
  };

  public async run(): Promise<TrialTemplate[]> {
    const { flags } = await this.parse(TrialforceListTemplate);
    const tsoConn = flags["target-org"].getConnection();
    const templates = await queryTrialTemplates(tsoConn);
    if (flags.latest) {
      this.log(templates[0].Id);
      return templates;
    }
    this.table({
      data: templates,
      columns: [
        { key: "Id", name: "ID" },
        { key: "Description", name: "DESCRIPTION" },
        { key: "CreatedDate", name: "CREATED DATE" },
      ],
    });
    return templates;
  }
}
