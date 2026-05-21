import { AuthInfo, MyDomainResolver, PollingClient } from "@salesforce/core";
import { MockTestOrgData, TestContext } from "@salesforce/core/testSetup";
import { stubSfCommandUx, stubSpinner } from "@salesforce/sf-plugins-core";
import { expect } from "chai";
import { describe } from "mocha";
import OrgResumeTrial from "../../../../src/commands/org/resume/trial.js";

const COMPLETED_SIGNUP_REQUEST = {
  Id: "0SR000000000001",
  Status: "Success" as const,
  ErrorCode: null,
  CreatedOrgId: "00D000000000001",
  Subdomain: "acme-trial",
  AuthCode: "abc123",
  Username: "admin@example.com.trial",
};

describe("org resume trial", () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    $$.SANDBOX.stub(MyDomainResolver.prototype, "resolve").resolves("127.0.0.1");
    $$.SANDBOX.stub(globalThis, "fetch").resolves({ status: 200 } as Response);
  });

  function stubAuthInfo($$: TestContext) {
    const mockAuthInfo = {
      handleAliasAndDefaultSettings: $$.SANDBOX.stub().resolves(),
      save: $$.SANDBOX.stub().resolves(),
    };
    const origCreate = AuthInfo.create.bind(AuthInfo);
    $$.SANDBOX.stub(AuthInfo, "create").callsFake(async (options) => {
      if (options && "oauth2Options" in options) return mockAuthInfo as never;
      return origCreate(options);
    });
    return mockAuthInfo;
  }

  it("should poll and return a CompletedSignupRequest", async () => {
    const mockSubscribe = $$.SANDBOX.stub().resolves(COMPLETED_SIGNUP_REQUEST);
    $$.SANDBOX.stub(PollingClient, "create").resolves({ subscribe: mockSubscribe } as never);
    stubAuthInfo($$);

    const result = await OrgResumeTrial.run([
      "-o",
      testOrg.username,
      "--signup-request-id",
      "0SR000000000001",
    ]);

    expect(result).to.deep.equal(COMPLETED_SIGNUP_REQUEST);
    expect(mockSubscribe.calledOnce).to.be.true;
  });

  it("should pass alias and setDefault to handleAliasAndDefaultSettings", async () => {
    const mockSubscribe = $$.SANDBOX.stub().resolves(COMPLETED_SIGNUP_REQUEST);
    $$.SANDBOX.stub(PollingClient, "create").resolves({ subscribe: mockSubscribe } as never);

    const origCreate = AuthInfo.create.bind(AuthInfo);
    const handleSettings = $$.SANDBOX.stub().resolves();
    const mockAuthInfo = {
      handleAliasAndDefaultSettings: handleSettings,
      save: $$.SANDBOX.stub().resolves(),
    };
    $$.SANDBOX.stub(AuthInfo, "create").callsFake(async (options) => {
      if (options && "oauth2Options" in options) return mockAuthInfo as never;
      return origCreate(options);
    });

    await OrgResumeTrial.run([
      "-o",
      testOrg.username,
      "--signup-request-id",
      "0SR000000000001",
      "--alias",
      "myAlias",
      "--set-default",
    ]);

    expect(
      handleSettings.calledOnceWith({
        alias: "myAlias",
        setDefault: true,
        setDefaultDevHub: false,
      }),
    ).to.be.true;
  });
});
