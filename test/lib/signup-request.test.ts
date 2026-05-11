import { Connection, PollingClient } from "@salesforce/core";
import { Duration } from "@salesforce/kit";
import { TestContext } from "@salesforce/core/testSetup";
import { expect } from "chai";
import { describe } from "mocha";
import { pollSignupRequest } from "../../src/lib/signup-request.js";

const BASE_RECORD = {
  Id: "0SR000000000001",
  ErrorCode: null,
  CreatedOrgId: null,
  Subdomain: null,
  AuthCode: null,
  Username: null,
};

describe("pollSignupRequest poll callback", () => {
  const $$ = new TestContext();

  async function capturePollFn(queryStub: ReturnType<typeof $$.SANDBOX.stub>) {
    let capturedPoll!: PollingClient.Options["poll"];
    $$.SANDBOX.stub(PollingClient, "create").callsFake(async (opts) => {
      capturedPoll = (opts as unknown as PollingClient.Options).poll;
      return { subscribe: $$.SANDBOX.stub().resolves(null) } as never;
    });
    const mockConn = { query: queryStub } as unknown as Connection;
    await pollSignupRequest(mockConn, "0SR000000000001", Duration.minutes(1));
    return capturedPoll;
  }

  it("returns { completed: false } when status is still In Progress", async () => {
    const query = $$.SANDBOX.stub().resolves({
      records: [{ ...BASE_RECORD, Status: "New" }],
      done: true,
      totalSize: 1,
    });
    const poll = await capturePollFn(query);
    const result = await poll();
    expect(result).to.deep.equal({ completed: false });
  });

  it("returns { completed: true, payload } when status is Success", async () => {
    const successRecord = {
      ...BASE_RECORD,
      Status: "Success",
      CreatedOrgId: "00D000000000001",
      Subdomain: "acme-trial",
      AuthCode: "abc123",
      Username: "admin@example.com.trial",
    };
    const query = $$.SANDBOX.stub().resolves({
      records: [successRecord],
      done: true,
      totalSize: 1,
    });
    const poll = await capturePollFn(query);
    const result = await poll();
    expect(result).to.deep.equal({ completed: true, payload: successRecord });
  });

  it("throws when the SignupRequest record is not found", async () => {
    const query = $$.SANDBOX.stub().resolves({ records: [], done: true, totalSize: 0 });
    const poll = await capturePollFn(query);

    let error: Error | undefined;
    try {
      await poll();
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.include("0SR000000000001");
    expect(error?.message).to.include("not found");
  });

  it("throws with the error code when status is Error", async () => {
    const query = $$.SANDBOX.stub().resolves({
      records: [{ ...BASE_RECORD, Status: "Error", ErrorCode: "S1006" }],
      done: true,
      totalSize: 1,
    });
    const poll = await capturePollFn(query);

    let error: Error | undefined;
    try {
      await poll();
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.include("S1006");
  });
});
