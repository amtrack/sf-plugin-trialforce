import { Connection } from "@salesforce/core";
import { MockTestOrgData, TestContext } from "@salesforce/core/testSetup";
import { stubSfCommandUx } from "@salesforce/sf-plugins-core";
import { expect } from "chai";
import { describe } from "mocha";
import TrialforceListTemplate from "../../../../src/commands/trialforce/list/template.js";

const MOCK_TEMPLATES = [
  {
    Id: "0TT000000000001AAA",
    Description: "Production Template",
    CreatedDate: "2024-03-01T10:00:00.000+0000",
  },
  {
    Id: "0TT000000000002AAA",
    Description: "Sandbox Template",
    CreatedDate: "2024-01-15T08:30:00.000+0000",
  },
];

describe("trialforce list template", () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
  });

  it("should return all templates without --latest", async () => {
    $$.SANDBOX.stub(Connection.prototype, "query").resolves({
      records: MOCK_TEMPLATES,
      done: true,
      totalSize: 2,
    });
    const result = await TrialforceListTemplate.run(["-o", testOrg.username]);
    expect(result).to.have.length(2);
    expect(result[0].Id).to.equal("0TT000000000001");
    expect(result[0].Description).to.equal("Production Template");
    expect(result[1].Id).to.equal("0TT000000000002");
  });

  it("should return all templates and log only the first Id with --latest", async () => {
    $$.SANDBOX.stub(Connection.prototype, "query").resolves({
      records: MOCK_TEMPLATES,
      done: true,
      totalSize: 2,
    });
    const result = await TrialforceListTemplate.run(["-o", testOrg.username, "--latest"]);
    expect(result).to.have.length(2);
    expect(result[0].Id).to.equal("0TT000000000001");
  });

  it("should return an empty array when no templates exist", async () => {
    $$.SANDBOX.stub(Connection.prototype, "query").resolves({
      records: [],
      done: true,
      totalSize: 0,
    });
    const result = await TrialforceListTemplate.run(["-o", testOrg.username]);
    expect(result).to.deep.equal([]);
  });
});
