import { AuthInfo, Connection, PollingClient } from "@salesforce/core";
import { MockTestOrgData, TestContext } from "@salesforce/core/testSetup";
import { stubSfCommandUx, stubSpinner } from "@salesforce/sf-plugins-core";
import { expect } from "chai";
import { describe } from "mocha";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import OrgCreateTrial from "../../../../src/commands/org/create/trial.js";

const REQUIRED_FLAGS = [
  "--company",
  "Acme",
  "--country",
  "US",
  "--signup-email",
  "admin@example.com",
  "--last-name",
  "Doe",
  "--username",
  "admin@example.com.trial",
  "--template-id",
  "0TT000000000001",
];

const COMPLETED_SIGNUP_REQUEST = {
  Id: "0SR000000000001",
  Status: "Success" as const,
  ErrorCode: null,
  CreatedOrgId: "00D000000000001",
  Subdomain: "acme-trial",
  AuthCode: "abc123",
  Username: "admin@example.com.trial",
};

describe("org create trial", () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
  });

  it("should submit a SignupRequest and return immediately with --async", async () => {
    const mockCreate = $$.SANDBOX.stub().resolves({ success: true, id: "0SR000000000001" });
    $$.SANDBOX.stub(Connection.prototype, "sobject").returns({ create: mockCreate } as never);

    const result = await OrgCreateTrial.run(["-o", testOrg.username, ...REQUIRED_FLAGS, "--async"]);

    expect(result.Id).to.equal("0SR000000000001");
    expect(mockCreate.calledOnce).to.be.true;
  });

  it("should poll and authenticate after SignupRequest completes (sync)", async () => {
    const mockCreate = $$.SANDBOX.stub().resolves({ success: true, id: "0SR000000000001" });
    $$.SANDBOX.stub(Connection.prototype, "sobject").returns({ create: mockCreate } as never);

    const mockSubscribe = $$.SANDBOX.stub().resolves(COMPLETED_SIGNUP_REQUEST);
    $$.SANDBOX.stub(PollingClient, "create").resolves({ subscribe: mockSubscribe } as never);

    const handleSettings = $$.SANDBOX.stub().resolves();
    const mockAuthInfo = {
      handleAliasAndDefaultSettings: handleSettings,
      save: $$.SANDBOX.stub().resolves(),
    };
    // Only intercept AuthInfo.create when it carries oauth2Options (from authenticateTrialOrg).
    // Calls without oauth2Options come from Org flag parsing and must reach the real implementation.
    const origCreate = AuthInfo.create.bind(AuthInfo);
    $$.SANDBOX.stub(AuthInfo, "create").callsFake(async (options) => {
      if (options && "oauth2Options" in options) return mockAuthInfo as never;
      return origCreate(options);
    });

    const result = await OrgCreateTrial.run(["-o", testOrg.username, ...REQUIRED_FLAGS]);

    expect(result).to.deep.include({ Id: "0SR000000000001", Status: "Success" });
    expect(handleSettings.calledOnce).to.be.true;
  });

  it("should throw when a required field is missing (Company)", async () => {
    const flagsWithoutCompany = REQUIRED_FLAGS.filter(
      (f, i) => f !== "--company" && REQUIRED_FLAGS[i - 1] !== "--company",
    );

    let error: Error | undefined;
    try {
      await OrgCreateTrial.run(["-o", testOrg.username, ...flagsWithoutCompany]);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.include("Missing required SignupRequest fields: Company");
  });

  it("should throw when neither --template-id nor --edition is provided", async () => {
    const flagsWithoutTemplate = REQUIRED_FLAGS.filter(
      (f, i) => f !== "--template-id" && REQUIRED_FLAGS[i - 1] !== "--template-id",
    );

    let error: Error | undefined;
    try {
      await OrgCreateTrial.run(["-o", testOrg.username, ...flagsWithoutTemplate]);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.include("Either --template-id or --edition is required");
  });

  it("should load field values from --definition-file and merge with flags", async () => {
    const defFile = join(tmpdir(), "trial-def-test.json");
    await writeFile(
      defFile,
      JSON.stringify({ Company: "FileCompany", Country: "DE", SignupEmail: "file@example.com" }),
    );

    const mockCreate = $$.SANDBOX.stub().resolves({ success: true, id: "0SR000000000002" });
    $$.SANDBOX.stub(Connection.prototype, "sobject").returns({ create: mockCreate } as never);

    const result = await OrgCreateTrial.run([
      "-o",
      testOrg.username,
      "--definition-file",
      defFile,
      "--last-name",
      "Doe",
      "--username",
      "file@example.com.trial",
      "--template-id",
      "0TT000000000001",
      "--async",
    ]);

    expect(result.Id).to.equal("0SR000000000002");
    const payload = mockCreate.firstCall.args[0] as Record<string, unknown>;
    expect(payload.Company).to.equal("FileCompany");
    expect(payload.Country).to.equal("DE");
  });

  it("should throw when sobject.create reports failure", async () => {
    const mockCreate = $$.SANDBOX.stub().resolves({
      success: false,
      errors: [{ message: "Insufficient permissions" }],
    });
    $$.SANDBOX.stub(Connection.prototype, "sobject").returns({ create: mockCreate } as never);

    let error: Error | undefined;
    try {
      await OrgCreateTrial.run(["-o", testOrg.username, ...REQUIRED_FLAGS, "--async"]);
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.include("Failed to create SignupRequest record");
    expect(error?.message).to.include("Insufficient permissions");
  });
});
