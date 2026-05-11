import { type Connection } from "@salesforce/core";

export type TrialTemplate = Record<string, unknown> & {
  Id: string;
  CreatedDate: string;
  Description: string;
};

export async function queryTrialTemplates(conn: Connection): Promise<TrialTemplate[]> {
  /**
   * TrialTemplate is an undocumented sObject.
   * `Id templateId = '0TT000000000000'; System.debug(templateId.getSObjectType()); // TrialTemplate`
   */
  const query =
    "SELECT Id, Description, CreatedDate FROM TrialTemplate WHERE Status = 'Success' ORDER BY CreatedDate DESC";
  const result = await conn.query<TrialTemplate>(query);
  return result.records.map((r) => ({
    ...r,
    Id: r.Id.slice(0, 15),
  }));
}
