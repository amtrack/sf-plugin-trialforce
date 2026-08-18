import { Connection } from "@salesforce/core";
import { MockTestOrgData, TestContext } from "@salesforce/core/testSetup";
import { stubSfCommandUx } from "@salesforce/sf-plugins-core";
import { expect } from "chai";
import { describe } from "mocha";
import OrgListTrial from "../../../../src/commands/org/list/trial.js";

const MOCK_RECORDS = [
  {
    Id: "0SR000000000001AAA",
    CreatedDate: "2024-03-01T10:00:00.000+0000",
    Country: "US",
    ErrorCode: null,
    SignupEmail: "admin@example.com",
    Status: "Success",
    Subdomain: "mytrialorg",
    Username: "admin@example.com.trial",
  },
  {
    Id: "0SR000000000002AAA",
    CreatedDate: "2024-02-15T08:30:00.000+0000",
    Country: "DE",
    ErrorCode: "T_EXCEED_MAX_TE_LIMIT",
    SignupEmail: "user@example.de",
    Status: "Error",
    Subdomain: null,
    Username: null,
  },
];

describe("org list trial", () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
  });

  it("should return all signup requests", async () => {
    $$.SANDBOX.stub(Connection.prototype, "query").resolves({
      records: MOCK_RECORDS,
      done: true,
      totalSize: 2,
    });
    const result = await OrgListTrial.run(["-o", testOrg.username]);
    expect(result).to.have.length(2);
    expect(result[0].Id).to.equal("0SR000000000001AAA");
    expect(result[0].Status).to.equal("Success");
    expect(result[1].Id).to.equal("0SR000000000002AAA");
    expect(result[1].Status).to.equal("Error");
    expect(result[1].ErrorCode).to.equal("T_EXCEED_MAX_TE_LIMIT");
  });

  it("should pass --limit to the query", async () => {
    const queryStub = $$.SANDBOX.stub(Connection.prototype, "query").resolves({
      records: [MOCK_RECORDS[0]],
      done: true,
      totalSize: 1,
    });
    await OrgListTrial.run(["-o", testOrg.username, "--limit", "1"]);
    const soql: string = queryStub.secondCall.args[0] as string;
    expect(soql).to.include("LIMIT 1");
  });

  it("should return an empty array when no records exist", async () => {
    $$.SANDBOX.stub(Connection.prototype, "query").resolves({
      records: [],
      done: true,
      totalSize: 0,
    });
    const result = await OrgListTrial.run(["-o", testOrg.username]);
    expect(result).to.deep.equal([]);
  });
});
