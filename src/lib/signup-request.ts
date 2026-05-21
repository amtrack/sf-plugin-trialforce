import {
  AuthInfo,
  Connection,
  MyDomainResolver,
  PollingClient,
  SfError,
  type StatusResult,
} from "@salesforce/core";
import { Duration } from "@salesforce/kit";
import { setTimeout } from "node:timers/promises";

export type SignupRequest = {
  Id: string;
  CreatedDate: string;
  Country: string | null;
  ErrorCode: string | null;
  SignupEmail: string | null;
  Status: string;
  Subdomain: string | null;
  Username: string | null;
};

export type SignupRequestInput = {
  TemplateId?: string;
  Edition?: string;
  Company?: string;
  Country?: string;
  SignupEmail?: string;
  FirstName?: string;
  LastName?: string;
  Username?: string;
  Subdomain?: string;
  ShouldConnectToEnvHub?: boolean;
  TrialDays?: number;
  PreferredLanguage?: string;
  SignupSource?: string;
  ConnectedAppConsumerKey?: string;
  ConnectedAppCallbackUrl?: string;
};

export type CreatedSignupRequest = SignupRequestInput & { Id: string };

export type SignupRequestRecord = {
  Id: string;
  Status: string;
  ErrorCode: string | null;
  CreatedOrgId: string | null;
  Subdomain: string | null;
  AuthCode: string | null;
  Username: string | null;
};

export type CompletedSignupRequest = SignupRequestRecord & {
  Status: "Success";
  CreatedOrgId: string;
  Subdomain: string;
  AuthCode: string;
  Username: string;
};

export async function querySignupRequests(
  conn: Connection,
  limit: number,
): Promise<SignupRequest[]> {
  const query = `SELECT Id, CreatedDate, Country, ErrorCode, SignupEmail, Status, Subdomain, Username FROM SignupRequest ORDER BY CreatedDate DESC LIMIT ${limit}`;
  const result = await conn.query<SignupRequest>(query);
  return result.records;
}

export async function createSignupRequest(
  conn: Connection,
  data: SignupRequestInput,
): Promise<CreatedSignupRequest> {
  const payload: SignupRequestInput = {
    ConnectedAppConsumerKey: "PlatformCLI",
    ConnectedAppCallbackUrl: "http://localhost:1717/OauthRedirect",
    ...data,
  };
  const result = await conn.sobject("SignupRequest").create(payload);
  if (!result.success || !result.id) {
    const errors = result.errors?.map((e) => (typeof e === "string" ? e : e.message)).join(", ");
    throw new SfError(`Failed to create SignupRequest record${errors ? `: ${errors}` : ""}`);
  }
  return { ...payload, Id: result.id };
}

export async function pollSignupRequest(
  conn: Connection,
  signupRequestId: string,
  wait: Duration,
): Promise<CompletedSignupRequest> {
  const pollingOptions: PollingClient.Options = {
    async poll(): Promise<StatusResult> {
      const records = await conn.query<SignupRequestRecord>(
        `SELECT Id, Status, ErrorCode, CreatedOrgId, Subdomain, AuthCode, Username FROM SignupRequest WHERE Id = '${signupRequestId}'`,
      );
      const result = records.records[0];
      if (!result) {
        throw new SfError(`SignupRequest ${signupRequestId} not found`);
      }
      if (result.Status === "Error") {
        throw new SfError(
          `Trial org creation failed with error code: ${result.ErrorCode ?? "Unknown"}`,
          "SignupRequestError",
        );
      }
      if (result.Status === "Success") {
        return { completed: true, payload: result };
      }
      return { completed: false };
    },
    timeout: wait,
    frequency: Duration.seconds(30),
    timeoutErrorName: "SignupRequestTimeoutError",
  };

  const client = await PollingClient.create(pollingOptions);
  const completed = await client.subscribe<SignupRequestRecord>();
  return completed as unknown as CompletedSignupRequest;
}

export async function authenticateTrialOrg(completed: CompletedSignupRequest): Promise<AuthInfo> {
  const loginUrl = `https://${completed.Subdomain}.my.salesforce.com`;
  const resolver = await MyDomainResolver.create({
    url: new URL(loginUrl),
    timeout: Duration.minutes(5),
    frequency: Duration.seconds(10),
  });
  await resolver.resolve();
  await waitForOrgReady(loginUrl, Duration.minutes(5), Duration.seconds(10));
  const authInfo = await AuthInfo.create({
    username: completed.Username,
    oauth2Options: {
      loginUrl,
      authCode: completed.AuthCode,
      clientId: "PlatformCLI",
    },
  });
  await authInfo.save();
  return authInfo;
}

async function waitForOrgReady(
  loginUrl: string,
  timeout: Duration,
  frequency: Duration,
): Promise<void> {
  const deadline = Date.now() + timeout.milliseconds;
  while (true) {
    const response = await fetch(loginUrl, { redirect: "follow" }).catch(() => null);
    if (response && response.status !== 420) {
      return;
    }
    if (Date.now() + frequency.milliseconds > deadline) {
      throw new SfError(
        `Org at ${loginUrl} did not become ready within ${timeout.minutes} minutes`,
      );
    }
    await setTimeout(frequency.milliseconds);
  }
}
